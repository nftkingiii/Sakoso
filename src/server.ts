import { buildApp } from "./app.js";
import { readConfig } from "./config.js";
import { OnchainAltanaAuthoritySource } from "./integrations/altana.js";
import { Scan8004AgentSource } from "./integrations/scan8004.js";

const config = readConfig();
const source = new Scan8004AgentSource({
  ...(config.SCAN8004_API_KEY ? { apiKey: config.SCAN8004_API_KEY } : {}),
  timeoutMs: config.UPSTREAM_TIMEOUT_MS,
  cacheTtlMs: config.CACHE_TTL_MS,
});
const authoritySource = new OnchainAltanaAuthoritySource();
const app = await buildApp({ source, authoritySource, revision: config.REVISION });

const shutdown = async (signal: string) => {
  app.log.info({ signal }, "shutdown requested");
  await app.close();
  process.exit(0);
};

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

try {
  await app.listen({ host: config.HOST, port: config.PORT });
} catch (error) {
  app.log.fatal({ error }, "server failed to start");
  process.exit(1);
}
