import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { z } from "zod";
import { AgentCategorySchema, categorySearchTerms } from "./domain/categories.js";
import { PrepareMandateSchema, prepareMandate } from "./domain/mandate.js";
import type { AgentListRequest, AgentSource, ScanAgent } from "./integrations/scan8004.js";

const AgentQuerySchema = z.object({
  category: AgentCategorySchema.optional(),
  q: z.string().trim().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  minimumScore: z.coerce.number().min(0).max(100).optional(),
  endpointVerified: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
  sort: z.enum(["quality", "recent", "feedback"]).default("quality"),
});

export interface BuildAppOptions {
  source: AgentSource;
  revision: string;
  now?: () => Date;
}

function publicAgent(agent: ScanAgent) {
  return {
    id: agent.agent_id,
    tokenId: agent.token_id,
    chainId: agent.chain_id,
    registry: agent.contract_address,
    owner: agent.owner_address,
    name: agent.name,
    description: agent.description ?? null,
    imageUrl: agent.image_url ?? null,
    protocols: agent.supported_protocols ?? [],
    payments: { x402: agent.x402_supported ?? false },
    evidence: {
      bscMainnet: agent.chain_id === 56 && !agent.is_testnet,
      identityVerified: agent.is_verified ?? false,
      endpointVerified: agent.is_endpoint_verified ?? null,
      publisherTier: agent.owner_publisher_tier ?? null,
      score: agent.total_score ?? null,
      healthScore: agent.health_score ?? null,
      feedbackCount: agent.total_feedbacks ?? 0,
      averageFeedback: agent.average_score ?? null,
      stars: agent.star_count ?? 0,
      observedUpdatedAt: agent.updated_at,
    },
  };
}

export async function buildApp(options: BuildAppOptions) {
  const app = Fastify({
    logger: {
      redact: ["req.headers.authorization", "req.headers.x-api-key"],
    },
    bodyLimit: 32 * 1_024,
    requestTimeout: 10_000,
  });

  await app.register(helmet, { global: true });
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: "1 minute",
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ error }, "request failed");
    if (reply.sent) return;
    void reply.status(500).send({
      error: { code: "INTERNAL_ERROR", message: "The request could not be completed." },
    });
  });

  app.get("/healthz", async () => ({
    status: "ok",
    service: "sakoso-api",
    revision: options.revision,
  }));

  app.get("/v1/categories", async () => ({
    items: AgentCategorySchema.options.map((id) => ({ id, searchIntent: categorySearchTerms[id] })),
  }));

  app.get(
    "/v1/coverage",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      try {
        const observedAt = (options.now ?? (() => new Date()))().toISOString();
        const results = await Promise.all(
          AgentCategorySchema.options.map(async (category) => {
            const result = await options.source.listAgents({
              limit: 1,
              offset: 0,
              search: categorySearchTerms[category],
              sortBy: "quality",
            });
            return {
              category,
              liveCandidateCount: result.total,
              leadingCandidate: result.items[0] ? publicAgent(result.items[0]) : null,
            };
          }),
        );

        return {
          items: results,
          complete: results.every((result) => result.liveCandidateCount > 0),
          source: { provider: "8004scan", chainId: 56, observedAt },
        };
      } catch (error) {
        request.log.warn({ error }, "category coverage upstream unavailable");
        return reply.status(502).send({
          error: {
            code: "AGENT_SOURCE_UNAVAILABLE",
            message: "Live BSC agent coverage is temporarily unavailable.",
          },
        });
      }
    },
  );

  app.get("/v1/agents", async (request, reply) => {
    const parsed = AgentQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(422).send({
        error: { code: "VALIDATION_ERROR", message: "Invalid agent query." },
      });
    }

    const searchParts = [
      parsed.data.category ? categorySearchTerms[parsed.data.category] : undefined,
      parsed.data.q,
    ].filter((value): value is string => Boolean(value));

    const sourceRequest: AgentListRequest = {
      limit: parsed.data.limit,
      offset: parsed.data.offset,
      sortBy: parsed.data.sort,
      ...(searchParts.length ? { search: searchParts.join(" ") } : {}),
      ...(parsed.data.minimumScore !== undefined
        ? { minimumScore: parsed.data.minimumScore }
        : {}),
      ...(parsed.data.endpointVerified !== undefined
        ? { endpointVerified: parsed.data.endpointVerified }
        : {}),
    };

    try {
      const result = await options.source.listAgents(sourceRequest);
      return {
        items: result.items.map(publicAgent),
        page: { total: result.total, limit: result.limit, offset: result.offset },
        source: {
          provider: "8004scan",
          chainId: 56,
          observedAt: (options.now ?? (() => new Date()))().toISOString(),
        },
      };
    } catch (error) {
      request.log.warn({ error }, "agent discovery upstream unavailable");
      return reply.status(502).send({
        error: {
          code: "AGENT_SOURCE_UNAVAILABLE",
          message: "Live BSC agent data is temporarily unavailable.",
        },
      });
    }
  });

  app.post(
    "/v1/mandates/prepare",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const parsed = PrepareMandateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(422).send({
          error: { code: "VALIDATION_ERROR", message: "Invalid mandate constraints." },
        });
      }

      try {
        return reply
          .status(201)
          .send(prepareMandate(parsed.data, (options.now ?? (() => new Date()))()));
      } catch (error) {
        return reply.status(422).send({
          error: {
            code: "INVALID_EXPIRY",
            message: error instanceof Error ? error.message : "Invalid mandate expiry.",
          },
        });
      }
    },
  );

  return app;
}
