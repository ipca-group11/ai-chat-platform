import { createApp } from "./app.js";
import { createAttachmentsRepository, createFileSystemStorage } from "./features/attachments/index.js";
import { runRetention, scheduleRetention } from "./features/retention/index.js";
import { loadEnv } from "./shared/env.js";
import { createLogger } from "./shared/logger.js";
import { prisma } from "./shared/prisma.js";

const env = loadEnv();
const logger = createLogger(env.LOG_LEVEL);
const app = createApp(prisma, env, logger);

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "conversation-service listening");
});

if (env.RETENTION_INTERVAL_MINUTES > 0) {
  const storage = createFileSystemStorage(env.UPLOAD_DIR);
  const attachmentsRepo = createAttachmentsRepository(prisma);
  scheduleRetention(
    async () => {
      const result = await runRetention(new Date(), {
        storage,
        attachmentsRepo,
        onFileError: (_storagePath, err) => logger.warn({ err }, "orphaned upload not removed, will retry"),
      });
      logger.info(result, "retention run finished");
    },
    env.RETENTION_INTERVAL_MINUTES * 60 * 1000,
    (err) => logger.error({ err }, "retention run failed"),
  );
}

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
