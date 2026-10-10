/**
 * Whole-app integration suite (AICHAT-57): every conversation-service route is called
 * through the real `createApp` with in-memory fakes. Each test title starts with the
 * route it covers ("METHOD /path"); `route-inventory.spec.ts` relies on that.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { cookieFor, tokenFor } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia, inviteVia } from "../test-utils/build-test-app.js";

async function sentMessage(t: ReturnType<typeof buildTestApp>, chatId: string, userId: string) {
  return t.messagesRepo.create({ chatId, ownerId: userId, authorEmail: `${userId}@example.com`, role: "user", content: "hi", status: "sent" });
}

describe("GET /health and GET /metrics", () => {
  it("GET /health · 200 without authentication", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /metrics · 200 with the Prometheus text format", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.text).toContain("http_request_duration_seconds");
  });

  it("an unknown route answers with the standard 404 body and a correlation id", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get("/nope").set("Cookie", cookieFor("user-1")).set("X-Correlation-Id", "abc-123");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
    expect(res.body.correlationId).toBe("abc-123");
  });
});

describe("chats routes", () => {
  it("GET /chats · 200 lists only the caller's chats; 401 without a token", async () => {
    const { app } = buildTestApp();
    await createChatVia(app, "user-1", { title: "mine" });
    await createChatVia(app, "user-2", { title: "theirs" });

    const res = await request(app).get("/chats").set("Cookie", cookieFor("user-1"));
    expect(res.status).toBe(200);
    expect(res.body.chats.map((c: { title: string }) => c.title)).toEqual(["mine"]);
    expect((await request(app).get("/chats")).status).toBe(401);
  });

  it("POST /chats · 201 creates a chat; 400 on an invalid body", async () => {
    const { app } = buildTestApp();
    const ok = await request(app).post("/chats").set("Cookie", cookieFor("user-1")).send({ title: "T", provider: "openai", model: "gpt-4o" });
    expect(ok.status).toBe(201);
    expect(ok.body.chat).toMatchObject({ title: "T", provider: "openai", ownerId: "user-1" });

    const bad = await request(app).post("/chats").set("Cookie", cookieFor("user-1")).send({ title: "", provider: "nope" });
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("GET /chats/:id · 200 for the owner; 404 CHAT_NOT_FOUND for another user", async () => {
    const { app } = buildTestApp();
    const chatId = await createChatVia(app, "user-1");

    expect((await request(app).get(`/chats/${chatId}`).set("Cookie", cookieFor("user-1"))).status).toBe(200);
    const other = await request(app).get(`/chats/${chatId}`).set("Cookie", cookieFor("user-2"));
    expect(other.status).toBe(404);
    expect(other.body.error.code).toBe("CHAT_NOT_FOUND");
  });

  it("PATCH /chats/:id · 200 renames; 400 on an empty body; 404 for a non-owner", async () => {
    const { app } = buildTestApp();
    const chatId = await createChatVia(app, "owner");
    await inviteVia(app, "owner", chatId, "guest@example.com");

    const ok = await request(app).patch(`/chats/${chatId}`).set("Cookie", cookieFor("owner")).send({ title: "Renamed" });
    expect(ok.status).toBe(200);
    expect(ok.body.chat.title).toBe("Renamed");

    expect((await request(app).patch(`/chats/${chatId}`).set("Cookie", cookieFor("owner")).send({})).status).toBe(400);
    // A member can read the chat but not change it.
    expect((await request(app).patch(`/chats/${chatId}`).set("Cookie", cookieFor("guest")).send({ title: "x" })).status).toBe(404);
    expect((await request(app).patch(`/chats/${chatId}`).set("Cookie", cookieFor("user-2")).send({ title: "x" })).status).toBe(404);
  });

  it("DELETE /chats/:id · 204 for the owner; 404 for another user, who cannot delete it", async () => {
    const { app, chatsRepo } = buildTestApp();
    const chatId = await createChatVia(app, "owner");

    expect((await request(app).delete(`/chats/${chatId}`).set("Cookie", cookieFor("user-2"))).status).toBe(404);
    expect(chatsRepo.has(chatId)).toBe(true);
    expect((await request(app).delete(`/chats/${chatId}`).set("Cookie", cookieFor("owner"))).status).toBe(204);
    expect(chatsRepo.has(chatId)).toBe(false);
  });
});

describe("membership routes", () => {
  it("GET /chats/:id/members · 200 lists owner first; 404 for a non-member", async () => {
    const { app } = buildTestApp();
    const chatId = await createChatVia(app, "owner");
    await inviteVia(app, "owner", chatId, "guest@example.com");

    const res = await request(app).get(`/chats/${chatId}/members`).set("Cookie", cookieFor("guest"));
    expect(res.status).toBe(200);
    expect(res.body.members.map((m: { role: string }) => m.role)).toEqual(["owner", "member"]);
    expect((await request(app).get(`/chats/${chatId}/members`).set("Cookie", cookieFor("user-2"))).status).toBe(404);
  });

  it("POST /chats/:id/members · 201 invites; 404 for a non-owner", async () => {
    const { app } = buildTestApp();
    const chatId = await createChatVia(app, "owner");

    const res = await request(app).post(`/chats/${chatId}/members`).set("Cookie", cookieFor("owner")).send({ email: "Guest@Example.com" });
    expect(res.status).toBe(201);
    expect(res.body.member).toMatchObject({ email: "guest@example.com", role: "member" });
    expect((await request(app).post(`/chats/${chatId}/members`).set("Cookie", cookieFor("user-2")).send({ email: "x@example.com" })).status).toBe(404);
  });

  it("DELETE /chats/:id/members/:email · 204 for the owner; 404 for a non-member caller", async () => {
    const { app } = buildTestApp();
    const chatId = await createChatVia(app, "owner");
    await inviteVia(app, "owner", chatId, "guest@example.com");
    const path = `/chats/${chatId}/members/${encodeURIComponent("guest@example.com")}`;

    expect((await request(app).delete(path).set("Cookie", cookieFor("user-2"))).status).toBe(404);
    expect((await request(app).delete(path).set("Cookie", cookieFor("owner"))).status).toBe(204);
  });

  it("DELETE /chats/:id/membership · 204 when a member leaves; 404 for a non-member", async () => {
    const { app } = buildTestApp();
    const chatId = await createChatVia(app, "owner");
    await inviteVia(app, "owner", chatId, "guest@example.com");

    expect((await request(app).delete(`/chats/${chatId}/membership`).set("Cookie", cookieFor("user-2"))).status).toBe(404);
    expect((await request(app).delete(`/chats/${chatId}/membership`).set("Cookie", cookieFor("guest"))).status).toBe(204);
  });
});

describe("messages routes", () => {
  it("GET /chats/:chatId/messages · 200 lists the history; 404 for another user", async () => {
    const t = buildTestApp();
    const chatId = await createChatVia(t.app, "user-1");
    await sentMessage(t, chatId, "user-1");

    const res = await request(t.app).get(`/chats/${chatId}/messages`).set("Cookie", cookieFor("user-1"));
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(1);
    expect((await request(t.app).get(`/chats/${chatId}/messages`).set("Cookie", cookieFor("user-2"))).status).toBe(404);
  });

  it("POST /chats/:chatId/messages · 201 sends and starts the queue; 400 on empty content; 404 for another user", async () => {
    const t = buildTestApp();
    const chatId = await createChatVia(t.app, "user-1");

    const ok = await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", cookieFor("user-1")).send({ content: "hello" });
    expect(ok.status).toBe(201);
    expect(ok.body.message).toMatchObject({ content: "hello", status: "sent" });
    expect((await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", cookieFor("user-1")).send({ content: "  " })).status).toBe(400);
    expect((await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", cookieFor("user-2")).send({ content: "x" })).status).toBe(404);
  });

  it("PATCH /chats/:chatId/messages/:messageId · 200 edits a queued message; 404 for another user", async () => {
    const t = buildTestApp();
    const chatId = await createChatVia(t.app, "user-1");
    const cookie = cookieFor("user-1");
    await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", cookie).send({ content: "first" });
    const queued = await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", cookie).send({ content: "second" });
    const path = `/chats/${chatId}/messages/${queued.body.message.id as string}`;

    const ok = await request(t.app).patch(path).set("Cookie", cookie).send({ content: "edited" });
    expect(ok.status).toBe(200);
    expect(ok.body.message.content).toBe("edited");
    expect((await request(t.app).patch(path).set("Cookie", cookieFor("user-2")).send({ content: "x" })).status).toBe(404);
  });

  it("DELETE /chats/:chatId/messages/:messageId · 204 cancels a queued message; 404 for another user", async () => {
    const t = buildTestApp();
    const chatId = await createChatVia(t.app, "user-1");
    const cookie = cookieFor("user-1");
    await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", cookie).send({ content: "first" });
    const queued = await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", cookie).send({ content: "second" });
    const id = queued.body.message.id as string;
    const path = `/chats/${chatId}/messages/${id}`;

    expect((await request(t.app).delete(path).set("Cookie", cookieFor("user-2"))).status).toBe(404);
    expect((await request(t.app).delete(path).set("Cookie", cookie)).status).toBe(204);
    expect(t.messagesRepo.has(id)).toBe(false);
  });

  it("POST /chats/:chatId/messages/:messageId/retry · 202 requeues a failed reply; 404 for another user", async () => {
    const t = buildTestApp();
    const chatId = await createChatVia(t.app, "user-1");
    const failed = await t.messagesRepo.create({ chatId, ownerId: "user-1", role: "assistant", content: "", status: "failed" });
    const path = `/chats/${chatId}/messages/${failed.id}/retry`;

    expect((await request(t.app).post(path).set("Cookie", cookieFor("user-2"))).status).toBe(404);
    const ok = await request(t.app).post(path).set("Cookie", cookieFor("user-1"));
    expect(ok.status).toBe(202);
    expect(ok.body.message.status).toBe("queued");
  });

  it("POST /chats/:chatId/stop · 200 reports whether a stream was stopped; 404 for another user", async () => {
    const t = buildTestApp();
    const chatId = await createChatVia(t.app, "user-1");
    const cookie = cookieFor("user-1");

    expect((await request(t.app).post(`/chats/${chatId}/stop`).set("Cookie", cookie)).body).toEqual({ stopped: false });
    await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", cookie).send({ content: "hi" });
    expect((await request(t.app).post(`/chats/${chatId}/stop`).set("Cookie", cookie)).body).toEqual({ stopped: true });
    expect((await request(t.app).post(`/chats/${chatId}/stop`).set("Cookie", cookieFor("user-2"))).status).toBe(404);
  });
});

describe("streaming route", () => {
  it("GET /chats/:chatId/stream · 401 without a token; 404 for another user; delivers events to the owner", async () => {
    const t = buildTestApp();
    const chatId = await createChatVia(t.app, "user-1");

    expect((await request(t.app).get(`/chats/${chatId}/stream`)).status).toBe(401);
    expect((await request(t.app).get(`/chats/${chatId}/stream`).set("Cookie", cookieFor("user-2"))).status).toBe(404);

    const server = t.app.listen(0);
    try {
      const port = (server.address() as AddressInfo).port;
      const firstChunk = await new Promise<string>((resolve, reject) => {
        const req = http.get(
          { port, path: `/chats/${chatId}/stream`, headers: { Cookie: `access_token=${tokenFor("user-1")}` } },
          (res) => {
            // The route subscribes in the same tick it sends the headers, so publishing
            // once they arrive cannot miss the event.
            t.bus.publish(chatId, { type: "token", messageId: "m1", token: "hi" });
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
    } finally {
      server.close();
    }
  });
});

describe("attachments route", () => {
  it("POST /chats/:chatId/messages/:messageId/attachments · 201 stores a text file; 404 for another user", async () => {
    const t = buildTestApp();
    const chatId = await createChatVia(t.app, "user-1");
    const message = await sentMessage(t, chatId, "user-1");
    const path = `/chats/${chatId}/messages/${message.id}/attachments`;

    const ok = await request(t.app).post(path).set("Cookie", cookieFor("user-1")).attach("file", Buffer.from("hello"), { filename: "n.txt", contentType: "text/plain" });
    expect(ok.status).toBe(201);
    expect(ok.body.attachment).toMatchObject({ filename: "n.txt", kind: "text" });
    expect(t.attachmentsRepo.all()).toHaveLength(1);

    const other = await request(t.app).post(path).set("Cookie", cookieFor("user-2")).attach("file", Buffer.from("x"), { filename: "n.txt", contentType: "text/plain" });
    expect(other.status).toBe(404);
  });
});
