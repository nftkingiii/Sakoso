import { z } from "zod";

const AgentSummarySchema = z
  .object({
    agent_id: z.string(),
    token_id: z.string(),
    chain_id: z.number().int(),
    contract_address: z.string(),
    is_testnet: z.boolean(),
    owner_address: z.string(),
    owner_publisher_tier: z.string().nullable().optional(),
    name: z.string(),
    description: z.string().nullable().optional(),
    image_url: z.string().nullable().optional(),
    is_verified: z.boolean().optional(),
    is_endpoint_verified: z.boolean().nullable().optional(),
    star_count: z.number().int().nonnegative().optional(),
    supported_protocols: z.array(z.string()).nullable().optional(),
    x402_supported: z.boolean().optional(),
    total_score: z.number().min(0).max(100).nullable().optional(),
    health_score: z.number().nullable().optional(),
    total_feedbacks: z.number().int().nonnegative().optional(),
    average_score: z.number().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
  })
  .passthrough();

const AgentListSchema = z.object({
  items: z.array(AgentSummarySchema),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});

export type ScanAgent = z.infer<typeof AgentSummarySchema>;

export interface AgentListRequest {
  limit: number;
  offset: number;
  search?: string;
  minimumScore?: number;
  endpointVerified?: boolean;
  sortBy: "quality" | "recent" | "feedback";
}

export interface AgentListResult {
  items: ScanAgent[];
  total: number;
  limit: number;
  offset: number;
}

export interface AgentSource {
  listAgents(request: AgentListRequest): Promise<AgentListResult>;
}

const sortFields: Record<AgentListRequest["sortBy"], string> = {
  quality: "total_score",
  recent: "created_at",
  feedback: "total_feedbacks",
};

interface Scan8004Options {
  apiKey?: string;
  timeoutMs: number;
  cacheTtlMs: number;
  fetchImplementation?: typeof fetch;
  retryCount?: number;
  retryDelayMs?: number;
}

interface CacheEntry {
  expiresAt: number;
  value: AgentListResult;
}

export class Scan8004AgentSource implements AgentSource {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly fetchImplementation: typeof fetch;

  constructor(private readonly options: Scan8004Options) {
    this.fetchImplementation = options.fetchImplementation ?? fetch;
  }

  async listAgents(request: AgentListRequest): Promise<AgentListResult> {
    const cacheKey = JSON.stringify(request);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const url = new URL("https://api.8004scan.io/api/v1/agents");
    url.searchParams.set("chain_id", "56");
    url.searchParams.set("limit", String(request.limit));
    url.searchParams.set("offset", String(request.offset));
    url.searchParams.set("sort_by", sortFields[request.sortBy]);
    url.searchParams.set("sort_order", "desc");
    if (request.search) url.searchParams.set("search", request.search);
    if (request.minimumScore !== undefined) {
      url.searchParams.set("min_score", String(request.minimumScore));
    }
    if (request.endpointVerified !== undefined) {
      url.searchParams.set("is_endpoint_verified", String(request.endpointVerified));
    }

    const headers = new Headers({ accept: "application/json" });
    if (this.options.apiKey) headers.set("X-API-Key", this.options.apiKey);

    const retryCount = Math.max(0, Math.min(this.options.retryCount ?? 1, 2));
    const retryDelayMs = Math.max(0, Math.min(this.options.retryDelayMs ?? 150, 2_000));
    let response: Response | undefined;
    let lastError: unknown;
    for (let attempt = 0; attempt <= retryCount; attempt += 1) {
      try {
        response = await this.fetchImplementation(url, {
          headers,
          redirect: "error",
          signal: AbortSignal.timeout(this.options.timeoutMs),
        });
        if (response.ok || ![408, 425, 429, 500, 502, 503, 504].includes(response.status)) break;
        lastError = new Error(`8004scan returned ${response.status}`);
      } catch (error) {
        lastError = error;
      }
      if (attempt < retryCount && retryDelayMs) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)));
      }
    }
    if (!response) throw (lastError instanceof Error ? lastError : new Error("8004scan request failed"));
    if (!response.ok) throw new Error(`8004scan returned ${response.status}`);

    const parsed = AgentListSchema.parse(await response.json());
    const filtered: AgentListResult = {
      ...parsed,
      items: parsed.items.filter((agent) => agent.chain_id === 56 && !agent.is_testnet),
    };
    this.cache.set(cacheKey, {
      expiresAt: Date.now() + this.options.cacheTtlMs,
      value: filtered,
    });
    return filtered;
  }
}
