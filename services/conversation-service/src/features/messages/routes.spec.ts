import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import { authMiddleware } from "../../shared/auth-middleware.js";
import { errorHandler, notFoundHandler } from "../../shared/error-handler.js";
import { FakeChatsRepository } from "../../test-utils/fake-chats-repository.js";
import { FakeMessagesRepository } from "../../test-utils/fake-messages-repository.js";
import { ChatsService } from "../chats/index.js";
import { QueueManager } from "../queue/index.js";
import { ChatEventBus } from "../streaming/index.js";
import { MessagesService } from "./service.js";
import { createMessagesRouter } from "./routes.js";
import { asUser } from "../../test-utils/principal.js";

const JWT_SECRET = "test-secret";

function tokenFor(userId: string): string {
  return jwt.sign({ sub: userId, email: `${userId}@example.com` }, JWT_SECRET, { expiresIn: "15m" });
}

function buildApp() {
  const chatsService = new ChatsService(new FakeChatsRepository());
  const messagesRepo = new FakeMessagesRepository();
  const queueManager = new QueueManager(vi.fn().mockReturnValue(new Promise(() => {})));
  const bus = new ChatEventBus();
  const service = new MessagesService(messagesRepo, chatsService, queueManager, bus);

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(authMiddleware(JWT_SECRET));
  app.use("/chats", createMessagesRouter(service));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return { app, chatsService, messagesRepo };
}

describe("messages routes", () => {
  it("AC-45: requests without a valid access token are rejected with 401", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/chats/any/messages");
    expect(res.status).toBe(401);
  });

  it("AC-51: an authenticated user can send a message and see it in the list", async () => {
    const { app, chatsService } = buildApp();
    const chat = await chatsService.create(asUser("user-1"), { title: "Chat", provider: "ollama", model: "llama3.2:1b" });
    const token = tokenFor("user-1");

    const sendRes = await request(app)
      .post(`/chats/${chat.id}/messages`)
      .set("Cookie", [`access_token=${token}`])
      .send({ content: "hello" });
    expect(sendRes.status).toBe(201);
    expect(sendRes.body.message.content).toBe("hello");

    const listRes = await request(app).get(`/chats/${chat.id}/messages`).set("Cookie", [`access_token=${token}`]);
    expect(listRes.body.messages).toHaveLength(1);
  });

  it("AC-46: user B sending a message to user A's chat receives 403 or 404", async () => {
    const { app, chatsService } = buildApp();
    const chat = await chatsService.create(asUser("user-a"), { title: "Chat", provider: "ollama", model: "llama3.2:1b" });
    const tokenB = tokenFor("user-b");

    const res = await request(app)
      .post(`/chats/${chat.id}/messages`)
      .set("Cookie", [`access_token=${tokenB}`])
      .send({ content: "hi" });

    expect([403, 404]).toContain(res.status);
  });

  it("AC-58: a queued message can be edited and canceled via the API", async () => {
    const { app, chatsService } = buildApp();
    const chat = await chatsService.create(asUser("user-1"), { title: "Chat", provider: "ollama", model: "llama3.2:1b" });
    const token = tokenFor("user-1");

    await request(app)
      .post(`/chats/${chat.id}/messages`)
      .set("Cookie", [`access_token=${token}`])
      .send({ content: "first" });
    const secondRes = await request(app)
      .post(`/chats/${chat.id}/messages`)
      .set("Cookie", [`access_token=${token}`])
      .send({ content: "second" });
    const secondId = secondRes.body.message.id as string;

    const editRes = await request(app)
      .patch(`/chats/${chat.id}/messages/${secondId}`)
      .set("Cookie", [`access_token=${token}`])
      .send({ content: "edited" });
    expect(editRes.status).toBe(200);
    expect(editRes.body.message.content).toBe("edited");

    const cancelRes = await request(app)
      .delete(`/chats/${chat.id}/messages/${secondId}`)
      .set("Cookie", [`access_token=${token}`]);
    expect(cancelRes.status).toBe(204);
  });

  it("AC-54: stop reports whether an in-progress stream was stopped", async () => {
    const { app, chatsService } = buildApp();
    const chat = await chatsService.create(asUser("user-1"), { title: "Chat", provider: "ollama", model: "llama3.2:1b" });
    const token = tokenFor("user-1");

    await request(app)
      .post(`/chats/${chat.id}/messages`)
      .set("Cookie", [`access_token=${token}`])
      .send({ content: "hi" });

    const stopRes = await request(app).post(`/chats/${chat.id}/stop`).set("Cookie", [`access_token=${token}`]);
    expect(stopRes.status).toBe(200);
    expect(stopRes.body).toEqual({ stopped: true });
  });

  it("AC-73: a failed message can be retried via the API", async () => {
    const { app, chatsService, messagesRepo } = buildApp();
    const chat = await chatsService.create(asUser("user-1"), { title: "Chat", provider: "ollama", model: "llama3.2:1b" });
    const failed = await messagesRepo.create({
      chatId: chat.id,
      ownerId: "user-1",
      role: "assistant",
      content: "",
      status: "failed",
    });
    const token = tokenFor("user-1");

    const res = await request(app)
      .post(`/chats/${chat.id}/messages/${failed.id}/retry`)
      .set("Cookie", [`access_token=${token}`]);

    expect(res.status).toBe(202);
    expect(res.body.message.status).toBe("queued");
  });
});
