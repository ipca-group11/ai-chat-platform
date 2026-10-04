import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { createAttachmentsRepository, createAttachmentsRouter, createFileCleanup, createFileSystemStorage, AttachmentsService, createAttachmentAwareContextBuilder, type AttachmentsRepository, type AttachmentStorage } from "./features/attachments/index.js";
import { createChatsRepository, createChatsRouter, ChatsService, type ChatsRepository } from "./features/chats/index.js";
import { createProviderRegistry, type ProviderRegistry } from "./features/llm-adapters/index.js";
import { createMessageProcessor, createMessagesRepository, createMessagesRouter, MessagesService, type MessagesRepository } from "./features/messages/index.js";
import { createErasureRepository, createErasureRouter, ErasureService, type ErasureRepository } from "./features/erasure/index.js";
import { QueueManager } from "./features/queue/index.js";
import { ChatEventBus, createStreamingRouter } from "./features/streaming/index.js";
import type { Env } from "./shared/env.js";
import { authMiddleware } from "./shared/auth-middleware.js";
import { correlationMiddleware } from "./shared/correlation-middleware.js";
import { errorHandler, notFoundHandler } from "./shared/error-handler.js";
import { createLogger, type Logger } from "./shared/logger.js";
import { buildSystemPrompt } from "./shared/system-prompt.js";
import { createMetrics } from "./shared/metrics.js";
import type { PrismaClient } from "./shared/prisma.js";

/** Optional replacements for the pieces `createApp` builds itself (testability seam,
 * plan decision D3). Every field defaults to the real implementation, so production
 * behaviour is unchanged; integration tests pass in-memory fakes to run the whole app
 * (real middleware order and routes) with no database, disk or network. */
export interface AppOverrides {
  chatsRepo?: ChatsRepository;
  messagesRepo?: MessagesRepository;
  attachmentsRepo?: AttachmentsRepository;
  storage?: AttachmentStorage;
  providerRegistry?: ProviderRegistry;
  /** Replaces the queue (and the message processor that feeds it). */
  queueManager?: QueueManager;
  bus?: ChatEventBus;
  erasureRepo?: ErasureRepository;
}

/** Builds the Express app + all its wiring (ARCHITECTURE.md §5). Takes the Prisma
 * client and env as parameters (rather than importing the singletons directly) so
 * `server.ts` is the only place that touches real process env/DB, keeping this factory
 * usable from integration tests too. */
export function createApp(
  prisma: PrismaClient,
  env: Env,
  logger: Logger = createLogger(env.LOG_LEVEL),
  overrides: AppOverrides = {},
): Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(",").map((o) => o.trim()), credentials: true }));
  app.use(correlationMiddleware(logger));

  const { metricsMiddleware, metricsHandler, activeStreams } = createMetrics();
  app.use(metricsMiddleware);
  // Body parsing after the correlation id and metrics, so a malformed body still gets both and the error
  // handler answers 400 with the request's id (AICHAT-217).
  app.use(express.json());
  app.use(cookieParser());
  app.get("/metrics", metricsHandler);
  app.get("/health", (_req, res) => res.json({ status: "ok" }));

  // --- wiring (ARCHITECTURE.md §5: chats -> messages/queue/streaming -> attachments) --
  const messagesRepo = overrides.messagesRepo ?? createMessagesRepository(prisma);
  const attachmentsRepo = overrides.attachmentsRepo ?? createAttachmentsRepository(prisma);
  const storage = overrides.storage ?? createFileSystemStorage(env.UPLOAD_DIR);
  // Removes the uploaded files of a chat or message once its rows are deleted (AICHAT-97).
  const fileCleanup = createFileCleanup(messagesRepo, attachmentsRepo, storage, (_storagePath, err) => {
    logger.warn({ err }, "could not remove an uploaded file");
  });

  const chatsRepo = overrides.chatsRepo ?? createChatsRepository(prisma);
  const chatsService = new ChatsService(chatsRepo, fileCleanup);

  const bus = overrides.bus ?? new ChatEventBus();
  const providerRegistry = overrides.providerRegistry ?? createProviderRegistry();

  const buildLlmMessages = createAttachmentAwareContextBuilder(attachmentsRepo, storage);

  const queueManager =
    overrides.queueManager ??
    new QueueManager(
      createMessageProcessor({ messagesRepo, chatsService, providerRegistry, bus, buildLlmMessages, systemPrompt: buildSystemPrompt(env.SYSTEM_PROMPT) }),
      (chatId, entry, error) => {
        logger.error({ chatId, messageId: entry.messageId, err: error }, "queue processor threw unexpectedly");
      },
    );

  const messagesService = new MessagesService(messagesRepo, chatsService, queueManager, bus, fileCleanup, attachmentsRepo);
  const attachmentsService = new AttachmentsService(
    attachmentsRepo,
    chatsService,
    messagesRepo,
    storage,
    providerRegistry,
    env.MAX_UPLOAD_BYTES,
  );

  // Service-to-service routes sit before the user authentication: auth-service calls them with the
  // service token. Not mounted at all when no token is configured.
  if (env.INTERNAL_SERVICE_TOKEN) {
    const erasureService = new ErasureService(overrides.erasureRepo ?? createErasureRepository(prisma), fileCleanup);
    app.use("/internal", createErasureRouter(erasureService, env.INTERNAL_SERVICE_TOKEN));
  }

  app.use(authMiddleware(env.JWT_SECRET));
  app.use("/chats", createChatsRouter(chatsService));
  app.use("/chats", createMessagesRouter(messagesService));
  app.use("/chats", createStreamingRouter(chatsService, bus, activeStreams));
  app.use("/chats", createAttachmentsRouter(attachmentsService, env.MAX_UPLOAD_BYTES));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
