import { z } from "zod";

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
  HOST: z.string().default("0.0.0.0"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  REVISION: z.string().trim().min(1).max(80).default("dev"),
  SCAN8004_API_KEY: z.string().trim().min(1).optional(),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().min(500).max(15_000).default(5_000),
  CACHE_TTL_MS: z.coerce.number().int().min(1_000).max(300_000).default(15_000),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

export function readConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return ConfigSchema.parse(environment);
}
