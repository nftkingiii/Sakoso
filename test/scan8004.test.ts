import { describe, expect, it, vi } from "vitest";
import { Scan8004AgentSource } from "../src/integrations/scan8004.js";

describe("8004scan integration", () => {
  it("pins discovery to registered, active BSC mainnet agents", async () => {
    const fetchImplementation = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ items: [], total: 0, limit: 10, offset: 0 }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );
    const source = new Scan8004AgentSource({
      timeoutMs: 1_000,
      cacheTtlMs: 10_000,
      fetchImplementation,
    });

    await source.listAgents({
      limit: 10,
      offset: 0,
      search: "yield optimisation",
      sortBy: "quality",
    });

    const calledUrl = fetchImplementation.mock.calls[0]?.[0] as URL;
    expect(calledUrl.origin).toBe("https://api.8004scan.io");
    expect(calledUrl.searchParams.get("chain_id")).toBe("56");
    expect(calledUrl.searchParams.get("is_testnet")).toBeNull();
    expect(calledUrl.searchParams.get("is_registered")).toBeNull();
    expect(calledUrl.searchParams.get("is_active")).toBeNull();
    expect(calledUrl.searchParams.get("search")).toBe("yield optimisation");
  });

  it("retries a transient upstream failure once, then preserves the source error", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValueOnce(new Response("busy", { status: 503 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], total: 0, limit: 10, offset: 0 }), { status: 200 }),
      );
    const source = new Scan8004AgentSource({
      timeoutMs: 1_000,
      cacheTtlMs: 10_000,
      retryDelayMs: 0,
      fetchImplementation,
    });

    await expect(
      source.listAgents({ limit: 10, offset: 0, sortBy: "quality" }),
    ).resolves.toMatchObject({ total: 0, items: [] });
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });
});
