import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import cookieParser from "cookie-parser";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TEST_JWT_SECRET, tokenFor } from "../../test-utils/auth-token.js";
import { authMiddleware } from "../../shared/auth-middleware.js";
import { errorHandler, notFoundHandler } from "../../shared/error-handler.js";
import { FakeChatsRepository } from "../../test-utils/fake-chats-repository.js";
import { ChatsService } from "../chats/index.js";
import { ChatEventBus } from "./sse.js";
import { createStreamingRouter, HEARTBEAT_INTERVAL_MS } from "./routes.js";
import { asUser } from "../../test-utils/principal.js";


function buildApp() {
  const repo = new FakeChatsRepository();
  const chatsService = new ChatsService(repo);
  const bus = new ChatEventBus();
  const app = express();
  app.use(cookieParser());
  app.use(authMiddleware(TEST_JWT_SECRET));
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
    const chat = await chatsService.create(asUser("user-a"), { title: "A's chat", provider: "ollama", model: "llama3.2:1b" });
    const tokenB = tokenFor("user-b");

    const res = await request(app).get(`/chats/${chat.id}/stream`).set("Cookie", [`access_token=${tokenB}`]);

    expect([403, 404]).toContain(res.status);
  });

  it("AC-52: an authenticated owner receives events published for their chat over SSE", async () => {
    const { chatsService } = buildApp();
    const bus = new ChatEventBus();
    const chat = await chatsService.create(asUser("user-1"), { title: "Chat", provider: "ollama", model: "llama3.2:1b" });
    const token = tokenFor("user-1");

    const streamApp = express();
    streamApp.use(cookieParser());
    streamApp.use(authMiddleware(TEST_JWT_SECRET));
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

            // The stream starts with a ": connected" comment; read until the event's frame arrives.
            let received = "";
            res.on("data", (chunk: Buffer) => {
              received += chunk.toString("utf-8");
              if (!received.includes("event: ")) return;
              resolve(received);
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

  it("tracks the open connection in the stream counter until the client disconnects", async () => {
    const { chatsService } = buildApp();
    const bus = new ChatEventBus();
    const chat = await chatsService.create(asUser("user-1"), { title: "Chat", provider: "anthropic", model: "claude-haiku-4-5" });
    const token = tokenFor("user-1");
    let open = 0;
    const counter = { inc: () => void open++, dec: () => void open-- };

    const streamApp = express();
    streamApp.use(cookieParser());
    streamApp.use(authMiddleware(TEST_JWT_SECRET));
    streamApp.use("/chats", createStreamingRouter(chatsService, bus, counter));

    const server = streamApp.listen(0);
    try {
      const port = (server.address() as AddressInfo).port;
      const req = await new Promise<http.ClientRequest>((resolve, reject) => {
        const r = http.get(
          { port, path: `/chats/${chat.id}/stream`, headers: { Cookie: `access_token=${token}` } },
          () => resolve(r),
        );
        r.on("error", (err) => {
          if (!(err as NodeJS.ErrnoException).code?.includes("ECONNRESET")) reject(err);
        });
      });

      expect(open).toBe(1);

      req.destroy();
      await vi.waitFor(() => expect(open).toBe(0));
    } finally {
      server.close();
    }
  });

  describe("AICHAT-169: disconnect and heartbeat", () => {
    const CONNECTED = ": connected\n\n";

    afterEach(() => {
      vi.useRealTimers();
    });

    /** Serves the stream on a real port and opens one connection that collects what it receives. */
    async function openRealStream(bus = new ChatEventBus()) {
      const { chatsService } = buildApp();
      const chat = await chatsService.create(asUser("user-1"), { title: "Chat", provider: "anthropic", model: "claude-haiku-4-5" });
      const streamApp = express();
      streamApp.use(cookieParser());
      streamApp.use(authMiddleware(TEST_JWT_SECRET));
      streamApp.use("/chats", createStreamingRouter(chatsService, bus));
      const server = streamApp.listen(0);
      const port = (server.address() as AddressInfo).port;
      let received = "";
      const req = await new Promise<http.ClientRequest>((resolve, reject) => {
        const r = http.get({ port, path: `/chats/${chat.id}/stream`, headers: { Cookie: `access_token=${tokenFor("user-1")}` } }, (res) => {
          res.on("data", (chunk: Buffer) => (received += chunk.toString("utf-8")));
          resolve(r);
        });
        r.on("error", (err) => {
          if (!(err as NodeJS.ErrnoException).code?.includes("ECONNRESET")) reject(err);
        });
      });
      return { bus, chatId: chat.id, req, server, received: () => received };
    }

    it("writes a first comment at once, so a proxy that holds the headers until the first body bytes still opens the stream", async () => {
      const stream = await openRealStream();
      try {
        await vi.waitFor(() => expect(stream.received()).toBe(CONNECTED));
      } finally {
        stream.req.destroy();
        stream.server.close();
      }
    });

    it("closing the connection unsubscribes it from the chat's event bus", async () => {
      const stream = await openRealStream();
      try {
        expect(stream.bus.subscriberCount(stream.chatId)).toBe(1);

        stream.req.destroy();

        await vi.waitFor(() => expect(stream.bus.subscriberCount(stream.chatId)).toBe(0));
      } finally {
        stream.server.close();
      }
    });

    it(`sends the comment ": ping" every ${HEARTBEAT_INTERVAL_MS / 1000} s on an idle stream, so proxies keep it open`, async () => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      const stream = await openRealStream();
      try {
        vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS - 1);
        await new Promise((resolve) => setTimeout(resolve, 20));
        expect(stream.received()).toBe(CONNECTED);

        vi.advanceTimersByTime(1);
        await vi.waitFor(() => expect(stream.received()).toBe(`${CONNECTED}: ping\n\n`));

        vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);
        await vi.waitFor(() => expect(stream.received()).toBe(`${CONNECTED}: ping\n\n: ping\n\n`));
      } finally {
        stream.req.destroy();
        stream.server.close();
      }
    });

    it("stops the heartbeat when the client disconnects (no timer left behind)", async () => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      const stream = await openRealStream();
      try {
        expect(vi.getTimerCount()).toBe(1);

        stream.req.destroy();

        await vi.waitFor(() => expect(vi.getTimerCount()).toBe(0));
      } finally {
        stream.server.close();
      }
    });

    it("events and heartbeats share the stream without breaking the SSE frames", async () => {
      vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
      const stream = await openRealStream();
      try {
        stream.bus.publish(stream.chatId, { type: "token", messageId: "m1", token: "hi" });
        vi.advanceTimersByTime(HEARTBEAT_INTERVAL_MS);

        await vi.waitFor(() =>
          expect(stream.received()).toBe(`${CONNECTED}event: token\ndata: ${JSON.stringify({ type: "token", messageId: "m1", token: "hi" })}\n\n: ping\n\n`),
        );
      } finally {
        stream.req.destroy();
        stream.server.close();
      }
    });
  });
});
