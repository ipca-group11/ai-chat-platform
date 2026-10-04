import type { Express } from "express";
import request from "supertest";
import { createApp, type AppOverrides } from "../app.js";
import type { Provider } from "../shared/contracts/chat.js";
import { parseEnv } from "../shared/env.js";
import { createLogger, type Logger } from "../shared/logger.js";
import type { PrismaClient } from "../shared/prisma.js";
import { cookieFor, TEST_JWT_SECRET, TEST_SERVICE_TOKEN } from "./auth-token.js";
import { FakeAttachmentsRepository } from "./fake-attachments-repository.js";
import { FakeChatsRepository } from "./fake-chats-repository.js";
import { FakeMessagesRepository } from "./fake-messages-repository.js";
import { fakeProviderRegistry } from "./fake-provider-registry.js";
import { createFakeQueue } from "./fake-queue.js";
import { FakeStorage } from "./fake-storage.js";
import { StubErasureRepository } from "./fake-erasure-repository.js";
import { ChatEventBus } from "../features/streaming/index.js";

export interface TestAppOptions {
  /** `MAX_UPLOAD_BYTES` for the app under test (default 10 MB). */
  maxUploadBytes?: number;
  overrides?: AppOverrides;
  /** Replaces the silent logger, for tests that read the log lines. */
  logger?: Logger;
  /** Extra environment settings, e.g. `SYSTEM_PROMPT`. */
  env?: Record<string, string>;
}

/** The real `createApp` (real middleware order, routers and error handler) wired to
 * in-memory fakes. Nothing touches a database, the disk or the network. The returned
 * fakes are the same instances the app uses, so a test can seed or inspect them. */
export function buildTestApp(options: TestAppOptions = {}) {
  const fakes = {
    chatsRepo: new FakeChatsRepository(),
    messagesRepo: new FakeMessagesRepository(),
    attachmentsRepo: new FakeAttachmentsRepository(),
    storage: new FakeStorage(),
    providerRegistry: fakeProviderRegistry(),
    queueManager: createFakeQueue(),
    bus: new ChatEventBus(),
    erasureRepo: new StubErasureRepository(),
  };
  const env = parseEnv({
    JWT_SECRET: TEST_JWT_SECRET,
    LOG_LEVEL: "silent",
    INTERNAL_SERVICE_TOKEN: TEST_SERVICE_TOKEN,
    ...(options.maxUploadBytes ? { MAX_UPLOAD_BYTES: String(options.maxUploadBytes) } : {}),
    ...options.env,
  });
  const app: Express = createApp({} as PrismaClient, env, options.logger ?? createLogger("silent"), { ...fakes, ...options.overrides });
  return { app, ...fakes };
}

export type TestApp = ReturnType<typeof buildTestApp>;

/** Creates a chat through the API as `userId` and returns its id. */
export async function createChatVia(
  app: Express,
  userId: string,
  body: { title?: string; provider?: Provider; model?: string } = {},
): Promise<string> {
  const res = await request(app)
    .post("/chats")
    .set("Cookie", cookieFor(userId))
    .send({ title: "Chat", provider: "anthropic", model: "claude-haiku-4-5", ...body });
  if (res.status !== 201) throw new Error(`could not create a chat: ${res.status}`);
  return (res.body as { chat: { id: string } }).chat.id;
}

/** Invites `email` to the chat as its owner. */
export async function inviteVia(app: Express, ownerId: string, chatId: string, email: string): Promise<void> {
  await request(app).post(`/chats/${chatId}/members`).set("Cookie", cookieFor(ownerId)).send({ email }).expect(201);
}
