import { createApp } from "./app.js";
import { loadEnv } from "./shared/env.js";
import { createLogger } from "./shared/logger.js";
import { prisma } from "./shared/prisma.js";

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);
const app = createApp(prisma, env, logger);

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "conversation-service listening");
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
