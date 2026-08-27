import { createHash } from "node:crypto";
import { z } from "zod";
import { AgentCategorySchema } from "./categories.js";

const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "invalid EVM address");
const SelectorSchema = z.string().regex(/^0x[a-fA-F0-9]{8}$/, "invalid function selector");
const BscAgentIdSchema = z
  .string()
  .regex(/^56:0x[a-fA-F0-9]{40}:[0-9]+$/, "agent must be an ERC-8004 identity on BSC mainnet");

export const PrepareMandateSchema = z.object({
  principal: AddressSchema,
  agentId: BscAgentIdSchema,
  category: AgentCategorySchema,
  objective: z.string().trim().min(10).max(500),
  expiresAt: z.string().datetime({ offset: true }),
  spend: z.object({
    asset: z.union([z.literal("native"), AddressSchema]),
    maxAtomicAmount: z.string().regex(/^[0-9]{1,78}$/, "amount must be an unsigned integer"),
  }),
  maxSlippageBps: z.number().int().min(0).max(1_000),
  allowedCalls: z
    .array(
      z.object({
        target: AddressSchema,
        selectors: z.array(SelectorSchema).min(1).max(16),
      }),
    )
    .min(1)
    .max(12),
});

export type PrepareMandateInput = z.infer<typeof PrepareMandateSchema>;

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries.map(([key, child]) => `${JSON.stringify(key)}:${canonicalize(child)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function prepareMandate(input: PrepareMandateInput, now = new Date()) {
  const expiresAt = new Date(input.expiresAt);
  const minimumExpiry = now.getTime() + 5 * 60 * 1_000;
  const maximumExpiry = now.getTime() + 30 * 24 * 60 * 60 * 1_000;
  if (expiresAt.getTime() < minimumExpiry || expiresAt.getTime() > maximumExpiry) {
    throw new Error("expiry must be between 5 minutes and 30 days from now");
  }

  const payload = {
    version: "sakoso-mandate/1" as const,
    chainId: 56 as const,
    ...input,
  };
  const canonicalPayload = canonicalize(payload);
  const digest = `0x${createHash("sha256").update(canonicalPayload).digest("hex")}`;

  return {
    status: "draft" as const,
    payload,
    canonicalPayload,
    digest,
    requiresWalletConfirmation: true,
    onchain: false,
  };
}
