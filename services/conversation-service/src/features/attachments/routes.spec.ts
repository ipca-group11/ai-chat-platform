import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { authMiddleware } from "../../shared/auth-middleware.js";
import { errorHandler, notFoundHandler } from "../../shared/error-handler.js";
import { FakeAttachmentsRepository } from "../../test-utils/fake-attachments-repository.js";
import { FakeChatsRepository } from "../../test-utils/fake-chats-repository.js";
import { FakeMessagesRepository } from "../../test-utils/fake-messages-repository.js";
import { FakeStorage } from "../../test-utils/fake-storage.js";
import { ChatsService } from "../chats/index.js";
import type { ProviderRegistry, LlmProvider } from "../llm-adapters/index.js";
import { AttachmentsService } from "./service.js";
import { createAttachmentsRouter } from "./routes.js";
import { asUser } from "../../test-utils/principal.js";

const JWT_SECRET = "test-secret";

function tokenFor(userId: string): string {
  return jwt.sign({ sub: userId, email: `${userId}@example.com` }, JWT_SECRET, { expiresIn: "15m" });
}

function fakeProvider(): LlmProvider {
  return { id: "anthropic", supportsVision: () => true, supportsReasoning: () => false, supportsWebFetch: () => false, async *sendMessage() {} };
}

function buildApp() {
  const chatsService = new ChatsService(new FakeChatsRepository());
  const messagesRepo = new FakeMessagesRepository();
  const attachmentsRepo = new FakeAttachmentsRepository();
  const storage = new FakeStorage();
  const registry: ProviderRegistry = { get: () => fakeProvider() };
  const service = new AttachmentsService(attachmentsRepo, chatsService, messagesRepo, storage, registry, 10 * 1024 * 1024);

  const app = express();
  app.use(cookieParser());
  app.use(authMiddleware(JWT_SECRET));
  app.use("/chats", createAttachmentsRouter(service, 12 * 1024 * 1024));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return { app, chatsService, messagesRepo };
}

describe("attachments routes", () => {
  it("AC-66: an authenticated user can upload a file attached to a message", async () => {
    const { app, chatsService, messagesRepo } = buildApp();
    const chat = await chatsService.create(asUser("user-1"), { title: "Chat", provider: "anthropic", model: "claude-haiku-4-5" });
    const message = await messagesRepo.create({ chatId: chat.id, ownerId: "user-1", role: "user", content: "hi", status: "sent" });
    const token = tokenFor("user-1");

    const res = await request(app)
      .post(`/chats/${chat.id}/messages/${message.id}/attachments`)
      .set("Cookie", [`access_token=${token}`])
      .attach("file", Buffer.from("hello world"), { filename: "notes.txt", contentType: "text/plain" });

    expect(res.status).toBe(201);
    expect(res.body.attachment.filename).toBe("notes.txt");
  });

  it("AC-45: uploading without a valid access token is rejected with 401", async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post("/chats/any/messages/any/attachments")
      .attach("file", Buffer.from("hi"), { filename: "a.txt", contentType: "text/plain" });
    expect(res.status).toBe(401);
  });

  it("AC-66: rejects an upload with no file attached", async () => {
    const { app, chatsService, messagesRepo } = buildApp();
    const chat = await chatsService.create(asUser("user-1"), { title: "Chat", provider: "anthropic", model: "claude-haiku-4-5" });
    const message = await messagesRepo.create({ chatId: chat.id, ownerId: "user-1", role: "user", content: "hi", status: "sent" });
    const token = tokenFor("user-1");

    const res = await request(app)
      .post(`/chats/${chat.id}/messages/${message.id}/attachments`)
      .set("Cookie", [`access_token=${token}`]);

    expect(res.status).toBe(400);
  });

  it("AC-68: rejects a disallowed file type with a 400", async () => {
    const { app, chatsService, messagesRepo } = buildApp();
    const chat = await chatsService.create(asUser("user-1"), { title: "Chat", provider: "anthropic", model: "claude-haiku-4-5" });
    const message = await messagesRepo.create({ chatId: chat.id, ownerId: "user-1", role: "user", content: "hi", status: "sent" });
    const token = tokenFor("user-1");

    const res = await request(app)
      .post(`/chats/${chat.id}/messages/${message.id}/attachments`)
      .set("Cookie", [`access_token=${token}`])
      .attach("file", Buffer.from("hi"), { filename: "a.exe", contentType: "application/octet-stream" });

    expect(res.status).toBe(400);
  });
});
