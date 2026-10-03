import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { createAttachmentsRepository, createAttachmentsRouter, createFileSystemStorage, AttachmentsService, createAttachmentAwareContextBuilder } from "./features/attachments/index.js";
import { createChatsRepository, createChatsRouter, ChatsService } from "./features/chats/index.js";
import { createProviderRegistry } from "./features/llm-adapters/index.js";
import { createMessageProcessor, createMessagesRepository, createMessagesRouter, MessagesService } from "./features/messages/index.js";
import { QueueManager } from "./features/queue/index.js";
import { ChatEventBus, createStreamingRouter } from "./features/streaming/index.js";
import type { Env } from "./shared/env.js";
import { authMiddleware } from "./shared/auth-middleware.js";
import { correlationMiddleware } from "./shared/correlation-middleware.js";
import { errorHandler, notFoundHandler } from "./shared/error-handler.js";
import { createLogger, type Logger } from "./shared/logger.js";
import { createMetrics } from "./shared/metrics.js";
import type { PrismaClient } from "./shared/prisma.js";

/** Builds the Express app + all its wiring (ARCHITECTURE.md §5). Takes the Prisma
 * client and env as parameters (rather than importing the singletons directly) so
 * `server.ts` is the only place that touches real process env/DB, keeping this factory
 * usable from integration tests too. */
export function createApp(prisma: PrismaClient, env: Env, logger: Logger = createLogger(env.LOG_LEVEL)): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()), credentials: true }));
  app.use(express.json());
  app.use(cookieParser());
  app.use(correlationMiddleware(logger));

  const { metricsMiddleware, metricsHandler } = createMetrics();
  app.use(metricsMiddleware);
  app.get("/metrics", metricsHandler);
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // --- wiring (ARCHITECTURE.md §5: chats -> messages/queue/streaming -> attachments) --
  const chatsRepo = createChatsRepository(prisma);
  const chatsService = new ChatsService(chatsRepo);

  const messagesRepo = createMessagesRepository(prisma);
  const bus = new ChatEventBus();
  const providerRegistry = createProviderRegistry();

  const attachmentsRepo = createAttachmentsRepository(prisma);
  const storage = createFileSystemStorage(env.UPLOAD_DIR);
  const buildLlmMessages = createAttachmentAwareContextBuilder(attachmentsRepo, storage);

  const processor = createMessageProcessor({
    messagesRepo,
    chatsService,
    providerRegistry,
    bus,
    buildLlmMessages,
  });
  const queueManager = new QueueManager(processor, (chatId, entry, error) => {
    logger.error({ chatId, messageId: entry.messageId, err: error }, "queue processor threw unexpectedly");
  });

  const messagesService = new MessagesService(messagesRepo, chatsService, queueManager, bus);
  const attachmentsService = new AttachmentsService(
    attachmentsRepo,
    chatsService,
    messagesRepo,
    storage,
    providerRegistry,
    env.MAX_UPLOAD_BYTES,
  );

  app.use(authMiddleware(env.JWT_SECRET));
  app.use("/chats", createChatsRouter(chatsService));
  app.use("/chats", createMessagesRouter(messagesService));
  app.use("/chats", createStreamingRouter(chatsService, bus));
  app.use("/chats", createAttachmentsRouter(attachmentsService, env.MAX_UPLOAD_BYTES * 2));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
