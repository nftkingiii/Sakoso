import { createHash } from "node:crypto";
import { getAddress } from "viem";
import { z } from "zod";

const AddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "expected an EVM address")
  .transform((value) => getAddress(value.toLowerCase()));

const FunctionSignatureSchema = z
  .string()
  .trim()
  .min(3)
  .max(200)
  .regex(
    /^(?:0x[a-fA-F0-9]{8}|[A-Za-z_$][A-Za-z0-9_$]*\([^\r\n]*\))$/,
    "expected a function signature or 4-byte selector",
  );

const AtomicAmountSchema = z
  .string()
  .regex(/^[0-9]+$/, "expected an unsigned integer string")
  .refine((value) => BigInt(value) > 0n, "spend limit must be positive")
  .refine((value) => value.length <= 78, "spend limit is too large");

export const PrepareAltanaSessionSchema = z.object({
  walletAddress: AddressSchema,
  allowedCalls: z
    .array(
      z.object({
        target: AddressSchema,
        signature: FunctionSignatureSchema,
      }),
    )
    .min(1)
    .max(16),
  spend: z.object({
    limitAtomicAmount: AtomicAmountSchema,
    period: z.enum(["minute", "hour", "day", "week", "month", "year"]),
    token: AddressSchema.optional(),
  }),
  expiresAt: z.iso.datetime({ offset: true }),
});

export type PrepareAltanaSessionInput = z.infer<typeof PrepareAltanaSessionSchema>;

const MIN_SESSION_SECONDS = 10 * 60;
const MAX_SESSION_SECONDS = 7 * 24 * 60 * 60;

export function prepareAltanaSession(input: PrepareAltanaSessionInput, now: Date) {
  const expiry = Math.floor(new Date(input.expiresAt).getTime() / 1_000);
  const nowSeconds = Math.floor(now.getTime() / 1_000);
  const duration = expiry - nowSeconds;

  if (duration < MIN_SESSION_SECONDS || duration > MAX_SESSION_SECONDS) {
    throw new Error("Altana session expiry must be between 10 minutes and 7 days from now.");
  }

  const payload = {
    version: "sakoso-altana-session/1" as const,
    chainId: 56 as const,
    walletAddress: input.walletAddress,
    permissions: {
      calls: input.allowedCalls.map(({ target, signature }) => ({ to: target, signature })),
      spend: [
        {
          limit: input.spend.limitAtomicAmount,
          period: input.spend.period,
          ...(input.spend.token ? { token: input.spend.token } : {}),
        },
      ],
    },
    expiry,
    registerInKeyStore: true as const,
  };

  const digest = `0x${createHash("sha256").update(JSON.stringify(payload)).digest("hex")}`;

  return {
    status: "draft" as const,
    requiresWalletConfirmation: true,
    onchain: false,
    digest,
    payload,
  };
}
