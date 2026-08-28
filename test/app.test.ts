import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import type { AltanaAuthoritySource } from "../src/integrations/altana.js";
import type { AgentSource } from "../src/integrations/scan8004.js";

const observedAt = new Date("2026-08-27T18:00:00.000Z");

function authoritySource(authorized = false): AltanaAuthoritySource {
  return {
    readAuthority: vi.fn().mockResolvedValue({
      walletAddress: "0x1111111111111111111111111111111111111111",
      keyId: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      authorized,
      blockNumber: 72_000_001n,
    }),
  };
}

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
  it("serves the product frontend with no-store HTML", async () => {
    const app = await buildApp({
      source: sourceWithOneAgent(),
      authoritySource: authoritySource(),
      revision: "test",
    });
    const response = await app.inject({ method: "GET", url: "/" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["cache-control"]).toBe("no-store");
    expect(response.headers["content-security-policy"]).toContain("style-src 'self'");
    expect(response.headers["content-security-policy"]).not.toContain("'unsafe-inline'");
    expect(response.body).toContain("Agents,");
    expect(response.body).toContain("with boundaries.");
    expect(response.body).toContain("Control the call.");
    expect(response.body).toContain('/assets/network-globe.webp');
    expect(response.body).toContain('<body class="is-landing">');
    expect(response.body).toContain('data-view="agents"');
    expect(response.body).toContain("Agent marketplace");
    expect(response.body).toContain("Find the right agent");
    expect(response.body).not.toContain("Choose an agent to work with.");
    expect(response.body).toContain('class="section-rail"');
    expect(response.body).toContain("Authority, end to end.");
    expect(response.body).not.toContain("Live market coverage");
    expect(response.body).toContain('data-panel="agents"');
    expect(response.body).not.toContain('data-view="control"');
    expect(response.body).toContain('data-panel="control"');
    expect(response.body).toContain("BNB Testnet · 97");
    expect(response.body).toContain('id="agent-detail"');
    expect(response.body).toContain('id="agent-detail-limits"');
    expect(response.body).not.toContain("data-scroll-agents");
    expect(response.body).not.toContain("↘");
    expect(response.body).toContain('/assets/app.js');
    await app.close();
  });

  it("serves the self-hosted visual system and product mark", async () => {
    const app = await buildApp({
      source: sourceWithOneAgent(),
      authoritySource: authoritySource(),
      revision: "test",
    });
    const [styles, mark, globe, script] = await Promise.all([
      app.inject({ method: "GET", url: "/assets/styles.css" }),
      app.inject({ method: "GET", url: "/assets/mark.svg" }),
      app.inject({ method: "GET", url: "/assets/network-globe.webp" }),
      app.inject({ method: "GET", url: "/assets/app.js" }),
    ]);

    expect(styles.statusCode).toBe(200);
    expect(styles.headers["content-type"]).toContain("text/css");
    expect(styles.body).toContain("prefers-reduced-motion");
    expect(mark.statusCode).toBe(200);
    expect(mark.headers["content-type"]).toContain("image/svg+xml");
    expect(mark.body).toContain("Sakoso bounded orbit");
    expect(globe.statusCode).toBe(200);
    expect(globe.headers["content-type"]).toContain("image/webp");
    expect(Number(globe.headers["content-length"])).toBeGreaterThan(50_000);
    expect(script.statusCode).toBe(200);
    expect(script.body).toContain("IntersectionObserver");
    expect(script.body).toContain("copy-registry-value");
    await app.close();
  });

  it("reports the served revision", async () => {
    const app = await buildApp({
      source: sourceWithOneAgent(),
      authoritySource: authoritySource(),
      revision: "abc123",
    });
    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", revision: "abc123" });
    await app.close();
  });

  it("returns normalized live-source evidence and applies the category intent", async () => {
    const source = sourceWithOneAgent();
    const app = await buildApp({
      source,
      authoritySource: authoritySource(),
      revision: "test",
      now: () => observedAt,
    });
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
    const app = await buildApp({
      source: sourceWithOneAgent(),
      authoritySource: authoritySource(),
      revision: "test",
    });
    const response = await app.inject({ method: "GET", url: "/v1/agents?category=sniping" });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    await app.close();
  });

  it("measures live-source coverage across every required category", async () => {
    const source = sourceWithOneAgent();
    const app = await buildApp({
      source,
      authoritySource: authoritySource(),
      revision: "test",
      now: () => observedAt,
    });
    const response = await app.inject({ method: "GET", url: "/v1/coverage" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      complete: true,
      items: [
        { category: "rebalancing", liveCandidateCount: 1 },
        { category: "grid-trading", liveCandidateCount: 1 },
        { category: "yield-optimisation", liveCandidateCount: 1 },
        { category: "health-factor-monitoring", liveCandidateCount: 1 },
      ],
    });
    expect(source.listAgents).toHaveBeenCalledTimes(4);
    await app.close();
  });

  it("prepares a deterministic, unsigned BSC mandate", async () => {
    const app = await buildApp({
      source: sourceWithOneAgent(),
      authoritySource: authoritySource(),
      revision: "test",
      now: () => observedAt,
    });
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
    const app = await buildApp({
      source: sourceWithOneAgent(),
      authoritySource: authoritySource(),
      revision: "test",
      now: () => observedAt,
    });
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

  it("prepares selector-scoped Altana permissions with a mandatory spend cap", async () => {
    const app = await buildApp({
      source: sourceWithOneAgent(),
      authoritySource: authoritySource(),
      revision: "test",
      now: () => observedAt,
    });
    const body = {
      walletAddress: "0x1111111111111111111111111111111111111111",
      allowedCalls: [
        {
          target: "0x2222222222222222222222222222222222222222",
          signature: "deposit()",
        },
      ],
      spend: { limitAtomicAmount: "100000000000000", period: "day" },
      expiresAt: "2026-08-27T19:00:00.000Z",
    };

    const first = await app.inject({
      method: "POST",
      url: "/v1/altana/sessions/prepare",
      payload: body,
    });
    const second = await app.inject({
      method: "POST",
      url: "/v1/altana/sessions/prepare",
      payload: body,
    });

    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({
      status: "draft",
      requiresWalletConfirmation: true,
      onchain: false,
      payload: {
        chainId: 97,
        registerInKeyStore: true,
        permissions: {
          calls: [{ to: expect.any(String), signature: "deposit()" }],
          spend: [{ limit: "100000000000000", period: "day" }],
        },
      },
      digest: expect.stringMatching(/^0x[0-9a-f]{64}$/),
    });
    expect(first.json().digest).toBe(second.json().digest);
    await app.close();
  });

  it("rejects Altana sessions without both a call allowlist and spend cap", async () => {
    const app = await buildApp({
      source: sourceWithOneAgent(),
      authoritySource: authoritySource(),
      revision: "test",
      now: () => observedAt,
    });
    const response = await app.inject({
      method: "POST",
      url: "/v1/altana/sessions/prepare",
      payload: {
        walletAddress: "0x1111111111111111111111111111111111111111",
        allowedCalls: [],
        expiresAt: "2026-08-27T19:00:00.000Z",
      },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    await app.close();
  });

  it("returns block-pinned Altana KeyStore authority evidence", async () => {
    const authority = authoritySource(true);
    const app = await buildApp({
      source: sourceWithOneAgent(),
      authoritySource: authority,
      revision: "test",
      now: () => observedAt,
    });
    const publicKey = `0x04${"11".repeat(64)}`;
    const response = await app.inject({
      method: "GET",
      url: `/v1/altana/authority?wallet=0x1111111111111111111111111111111111111111&publicKey=${publicKey}`,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      authorized: true,
      status: "active",
      observedAt: observedAt.toISOString(),
      observedBlock: "72000001",
      source: { kind: "onchain", chainId: 97 },
      explorer: {
        account: expect.stringContaining("testnet.altana.network/account/"),
        key: expect.stringContaining("testnet.altana.network/key/"),
      },
    });
    expect(authority.readAuthority).toHaveBeenCalledWith({
      walletAddress: "0x1111111111111111111111111111111111111111",
      publicKey,
    });
    await app.close();
  });

  it("does not accept a private key at the Altana authority boundary", async () => {
    const app = await buildApp({
      source: sourceWithOneAgent(),
      authoritySource: authoritySource(),
      revision: "test",
    });
    const response = await app.inject({
      method: "GET",
      url: `/v1/altana/authority?wallet=0x1111111111111111111111111111111111111111&publicKey=0x${"11".repeat(32)}`,
    });

    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    await app.close();
  });
});
