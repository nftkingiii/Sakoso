import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { AgentSource } from "../src/integrations/scan8004.js";

const observedAt = new Date("2026-08-27T18:00:00.000Z");

function sourceWithOneAgent(): AgentSource {
  return {
    listAgents: vi.fn().mockResolvedValue({
      items: [
        {
          agent_id: "56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:42",
          token_id: "42",
          chain_id: 56,
          contract_address: "0x8004a169fb4a3325136eb29fa0ceb6d2e539a432",
          is_testnet: false,
          owner_address: "0x1111111111111111111111111111111111111111",
          name: "Live rebalancer",
          description: "Maintains liquidity ranges.",
          supported_protocols: ["A2A", "ERC-8183"],
          x402_supported: true,
          total_score: 82,
          total_feedbacks: 7,
          average_score: 91,
          created_at: "2026-08-20T00:00:00Z",
          updated_at: "2026-08-27T17:00:00Z",
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    }),
  };
}

describe("Sakoso API", () => {
  it("reports the served revision", async () => {
    const app = await buildApp({ source: sourceWithOneAgent(), revision: "abc123" });
    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", revision: "abc123" });
    await app.close();
  });

  it("returns normalized live-source evidence and applies the category intent", async () => {
    const source = sourceWithOneAgent();
    const app = await buildApp({ source, revision: "test", now: () => observedAt });
    const response = await app.inject({
      method: "GET",
      url: "/v1/agents?category=rebalancing",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [{ id: expect.stringMatching(/^56:/), evidence: { bscMainnet: true, score: 82 } }],
      source: { provider: "8004scan", chainId: 56, observedAt: observedAt.toISOString() },
    });
    expect(source.listAgents).toHaveBeenCalledWith(
      expect.objectContaining({ search: "liquidity position range rebalancing" }),
    );
    await app.close();
  });

  it("rejects unsupported categories at the boundary", async () => {
    const app = await buildApp({ source: sourceWithOneAgent(), revision: "test" });
    const response = await app.inject({ method: "GET", url: "/v1/agents?category=sniping" });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    await app.close();
  });

  it("prepares a deterministic, unsigned BSC mandate", async () => {
    const app = await buildApp({ source: sourceWithOneAgent(), revision: "test", now: () => observedAt });
    const body = {
      principal: "0x1111111111111111111111111111111111111111",
      agentId: "56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:42",
      category: "health-factor-monitoring",
      objective: "Protect my Venus position before liquidation.",
      expiresAt: "2026-08-28T18:00:00.000Z",
      spend: { asset: "native", maxAtomicAmount: "10000000000000000" },
      maxSlippageBps: 50,
      allowedCalls: [
        {
          target: "0x2222222222222222222222222222222222222222",
          selectors: ["0x12345678"],
        },
      ],
    };

    const first = await app.inject({ method: "POST", url: "/v1/mandates/prepare", payload: body });
    const second = await app.inject({ method: "POST", url: "/v1/mandates/prepare", payload: body });

    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({
      status: "draft",
      requiresWalletConfirmation: true,
      onchain: false,
      payload: { chainId: 56, version: "sakoso-mandate/1" },
      digest: expect.stringMatching(/^0x[0-9a-f]{64}$/),
    });
    expect(first.json().digest).toBe(second.json().digest);
    await app.close();
  });

  it("rejects mandates that expire outside the bounded window", async () => {
    const app = await buildApp({ source: sourceWithOneAgent(), revision: "test", now: () => observedAt });
    const response = await app.inject({
      method: "POST",
      url: "/v1/mandates/prepare",
      payload: {
        principal: "0x1111111111111111111111111111111111111111",
        agentId: "56:0x8004a169fb4a3325136eb29fa0ceb6d2e539a432:42",
        category: "rebalancing",
        objective: "Rebalance my position within the declared range.",
        expiresAt: "2026-10-30T18:00:00.000Z",
        spend: { asset: "native", maxAtomicAmount: "1" },
        maxSlippageBps: 10,
        allowedCalls: [
          {
            target: "0x2222222222222222222222222222222222222222",
            selectors: ["0x12345678"],
          },
        ],
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: { code: "INVALID_EXPIRY" } });
    await app.close();
  });
});
