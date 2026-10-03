import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { authMiddleware } from "../../shared/auth-middleware.js";
import { errorHandler, notFoundHandler } from "../../shared/error-handler.js";
import { FakeChatsRepository } from "../../test-utils/fake-chats-repository.js";
import { ChatsService } from "../chats/index.js";
import { ChatEventBus } from "./sse.js";
import { createStreamingRouter } from "./routes.js";
import { asUser } from "../../test-utils/principal.js";

const JWT_SECRET = "test-secret";

function tokenFor(userId: string): string {
  return jwt.sign({ sub: userId, email: `${userId}@example.com` }, JWT_SECRET, { expiresIn: "15m" });
}

function buildApp() {
  const repo = new FakeChatsRepository();
  const chatsService = new ChatsService(repo);
  const bus = new ChatEventBus();
  const app = express();
  app.use(cookieParser());
  app.use(authMiddleware(JWT_SECRET));
  app.use("/chats", createStreamingRouter(chatsService, bus));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return { app, chatsService };
}

describe("streaming routes", () => {
  it("AC-45: rejects a stream request without a valid access token", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/chats/does-not-exist/stream");
    expect(res.status).toBe(401);
  });

  it("AC-46: user B opening user A's chat stream receives 403 or 404", async () => {
    const { app, chatsService } = buildApp();
    const chat = await chatsService.create(asUser("user-a"), { title: "A's chat", provider: "anthropic", model: "claude-haiku-4-5" });
    const tokenB = tokenFor("user-b");

    const res = await request(app).get(`/chats/${chat.id}/stream`).set("Cookie", [`access_token=${tokenB}`]);

    expect([403, 404]).toContain(res.status);
  });

  it("AC-52: an authenticated owner receives events published for their chat over SSE", async () => {
    const { chatsService } = buildApp();
    const bus = new ChatEventBus();
    const chat = await chatsService.create(asUser("user-1"), { title: "Chat", provider: "anthropic", model: "claude-haiku-4-5" });
    const token = tokenFor("user-1");

    const streamApp = express();
    streamApp.use(cookieParser());
    streamApp.use(authMiddleware(JWT_SECRET));
    streamApp.use("/chats", createStreamingRouter(chatsService, bus));

    const server = streamApp.listen(0);
    try {
      const port = (server.address() as AddressInfo).port;

      const firstChunk = await new Promise<string>((resolve, reject) => {
        const req = http.get(
          { port, path: `/chats/${chat.id}/stream`, headers: { Cookie: `access_token=${token}` } },
          (res) => {
            // The server subscribes to the bus synchronously, in the same tick it
            // flushes response headers (see routes.ts), before any bytes reach the
            // client — so publishing only once headers have actually arrived here
            // guarantees the subscription is already in place, with no arbitrary
            // timing assumption.
            bus.publish(chat.id, { type: "token", messageId: "m1", token: "hi" });

            res.on("data", (chunk: Buffer) => {
              resolve(chunk.toString("utf-8"));
              req.destroy();
            });
            res.on("error", reject);
          },
        );
        req.on("error", (err) => {
          if (!(err as NodeJS.ErrnoException).code?.includes("ECONNRESET")) reject(err);
        });
      });

      expect(firstChunk).toContain("event: token");
      expect(firstChunk).toContain('"token":"hi"');
    } finally {
      server.close();
    }
  });
});
