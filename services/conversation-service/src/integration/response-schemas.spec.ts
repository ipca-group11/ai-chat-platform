/**
 * AICHAT-185: every route is called through the real app (in-memory fakes) and each response is
 * checked against the OpenAPI route table: the status must be documented, the body must match its
 * Zod schema with no unknown field at any depth, and every error is the shared envelope with the
 * `X-Correlation-Id` header. The last test fails if a route's success response was never checked.
 */
import http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { cookieFor, TEST_SERVICE_TOKEN, tokenFor } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia, inviteVia } from "../test-utils/build-test-app.js";
import { createResponseChecker, type CheckedResponse } from "../test-utils/documented-response.js";

const { expectDocumentedResponse: check, uncheckedSuccesses } = createResponseChecker();
const owner = cookieFor("owner");
const stranger = cookieFor("stranger");
const service = `Bearer ${TEST_SERVICE_TOKEN}`;

async function chatWithMessages() {
  const t = buildTestApp();
  const chatId = await createChatVia(t.app, "owner");
  // The first message starts the (never ending) fake reply, so the second one stays queued.
  const first = await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", owner).send({ content: "first" });
  const queued = await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", owner).send({ content: "second" });
  return { t, chatId, sentId: first.body.message.id as string, queuedId: queued.body.message.id as string };
}

/** Opens the event stream and returns its status and headers, closing it right away. */
async function openStream(t: ReturnType<typeof buildTestApp>, chatId: string, userId: string): Promise<CheckedResponse> {
  const server = t.app.listen(0);
  try {
    const port = (server.address() as AddressInfo).port;
    return await new Promise<CheckedResponse>((resolve, reject) => {
      const req = http.get({ port, path: `/chats/${chatId}/stream`, headers: { Cookie: `access_token=${tokenFor(userId)}` } }, (res) => {
        resolve({ status: res.statusCode ?? 0, headers: res.headers, text: "" });
        req.destroy();
      });
      req.on("error", (err) => {
        if (!(err as NodeJS.ErrnoException).code?.includes("ECONNRESET")) reject(err);
      });
    });
  } finally {
    server.close();
  }
}

describe("operations", () => {
  it("GET /health and GET /metrics", async () => {
    const { app } = buildTestApp();
    check("GET /health", await request(app).get("/health"));
    check("GET /metrics", await request(app).get("/metrics"));
  });
});

describe("chats", () => {
  it("GET /chats · 200 and 401", async () => {
    const { app } = buildTestApp();
    await createChatVia(app, "owner");
    check("GET /chats", await request(app).get("/chats").set("Cookie", owner));
    check("GET /chats", await request(app).get("/chats"));
  });

  it("POST /chats · 201 and 400", async () => {
    const { app } = buildTestApp();
    check("POST /chats", await request(app).post("/chats").set("Cookie", owner).send({ title: "T", provider: "openai", model: "gpt-4o", reasoning: true }));
    check("POST /chats", await request(app).post("/chats").set("Cookie", owner).send({ title: "", provider: "nope" }));
  });

  it("GET, PATCH and DELETE /chats/:id · 200/204, 400 and 404", async () => {
    const { app } = buildTestApp();
    const id = await createChatVia(app, "owner");
    check("GET /chats/:id", await request(app).get(`/chats/${id}`).set("Cookie", owner));
    check("GET /chats/:id", await request(app).get(`/chats/${id}`).set("Cookie", stranger));
    check("PATCH /chats/:id", await request(app).patch(`/chats/${id}`).set("Cookie", owner).send({ title: "Renamed" }));
    check("PATCH /chats/:id", await request(app).patch(`/chats/${id}`).set("Cookie", owner).send({}));
    check("PATCH /chats/:id", await request(app).patch(`/chats/${id}`).set("Cookie", stranger).send({ title: "x" }));
    check("DELETE /chats/:id", await request(app).delete(`/chats/${id}`).set("Cookie", stranger));
    check("DELETE /chats/:id", await request(app).delete(`/chats/${id}`).set("Cookie", owner));
  });
});

describe("members", () => {
  it("GET and POST /chats/:id/members · 200/201, 400, 404 and 409", async () => {
    const { app } = buildTestApp();
    const id = await createChatVia(app, "owner");
    check("POST /chats/:id/members", await request(app).post(`/chats/${id}/members`).set("Cookie", owner).send({ email: "member@example.com" }));
    check("POST /chats/:id/members", await request(app).post(`/chats/${id}/members`).set("Cookie", owner).send({ email: "member@example.com" }));
    check("POST /chats/:id/members", await request(app).post(`/chats/${id}/members`).set("Cookie", owner).send({ email: "not-an-email" }));
    check("POST /chats/:id/members", await request(app).post(`/chats/${id}/members`).set("Cookie", stranger).send({ email: "a@example.com" }));
    check("GET /chats/:id/members", await request(app).get(`/chats/${id}/members`).set("Cookie", owner));
    check("GET /chats/:id/members", await request(app).get(`/chats/${id}/members`).set("Cookie", stranger));
  });

  it("DELETE /chats/:id/members/:email and DELETE /chats/:id/membership · 204, 403 and 404", async () => {
    const { app } = buildTestApp();
    const id = await createChatVia(app, "owner");
    await inviteVia(app, "owner", id, "member@example.com");
    await inviteVia(app, "owner", id, "other@example.com");
    const member = cookieFor("member");
    check("DELETE /chats/:id/members/:email", await request(app).delete(`/chats/${id}/members/other@example.com`).set("Cookie", member));
    check("DELETE /chats/:id/members/:email", await request(app).delete(`/chats/${id}/members/nobody@example.com`).set("Cookie", owner));
    check("DELETE /chats/:id/members/:email", await request(app).delete(`/chats/${id}/members/other@example.com`).set("Cookie", owner));
    check("DELETE /chats/:id/membership", await request(app).delete(`/chats/${id}/membership`).set("Cookie", member));
    check("DELETE /chats/:id/membership", await request(app).delete(`/chats/${id}/membership`).set("Cookie", stranger));
  });
});

describe("messages", () => {
  it("GET and POST /chats/:chatId/messages · 200/201, 400 and 404", async () => {
    const { t, chatId } = await chatWithMessages();
    check("GET /chats/:chatId/messages", await request(t.app).get(`/chats/${chatId}/messages`).set("Cookie", owner));
    check("GET /chats/:chatId/messages", await request(t.app).get(`/chats/${chatId}/messages`).set("Cookie", stranger));
    check(
      "POST /chats/:chatId/messages",
      await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", owner).set("X-Llm-Api-Key", "sk-test").send({ content: "third" }),
    );
    check("POST /chats/:chatId/messages", await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", owner).send({ content: "" }));
    check("POST /chats/:chatId/messages", await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", stranger).send({ content: "x" }));
  });

  it("PATCH and DELETE /chats/:chatId/messages/:messageId · 200/204, 400, 404 and 409", async () => {
    const { t, chatId, sentId, queuedId } = await chatWithMessages();
    const path = (id: string) => `/chats/${chatId}/messages/${id}`;
    check("PATCH /chats/:chatId/messages/:messageId", await request(t.app).patch(path(queuedId)).set("Cookie", owner).send({ content: "edited" }));
    check("PATCH /chats/:chatId/messages/:messageId", await request(t.app).patch(path(queuedId)).set("Cookie", owner).send({ content: "" }));
    check("PATCH /chats/:chatId/messages/:messageId", await request(t.app).patch(path(sentId)).set("Cookie", owner).send({ content: "late" }));
    check("PATCH /chats/:chatId/messages/:messageId", await request(t.app).patch(path("missing")).set("Cookie", owner).send({ content: "x" }));
    check("DELETE /chats/:chatId/messages/:messageId", await request(t.app).delete(path(sentId)).set("Cookie", owner));
    check("DELETE /chats/:chatId/messages/:messageId", await request(t.app).delete(path(queuedId)).set("Cookie", stranger));
    check("DELETE /chats/:chatId/messages/:messageId", await request(t.app).delete(path(queuedId)).set("Cookie", owner));
  });

  it("POST /chats/:chatId/messages/:messageId/retry · 202, 404 and 409", async () => {
    const t = buildTestApp();
    const chatId = await createChatVia(t.app, "owner");
    const failed = await t.messagesRepo.create({ chatId, ownerId: "owner", role: "assistant", content: "", status: "failed", error: "Provider error" });
    const sent = await t.messagesRepo.create({ chatId, ownerId: "owner", authorEmail: "owner@example.com", role: "user", content: "hi", status: "sent" });
    const retry = (id: string) => `/chats/${chatId}/messages/${id}/retry`;
    check("POST /chats/:chatId/messages/:messageId/retry", await request(t.app).post(retry(sent.id)).set("Cookie", owner));
    check("POST /chats/:chatId/messages/:messageId/retry", await request(t.app).post(retry(failed.id)).set("Cookie", stranger));
    check("POST /chats/:chatId/messages/:messageId/retry", await request(t.app).post(retry(failed.id)).set("Cookie", owner));
  });

  it("POST /chats/:chatId/stop · 200 and 404", async () => {
    const { t, chatId } = await chatWithMessages();
    check("POST /chats/:chatId/stop", await request(t.app).post(`/chats/${chatId}/stop`).set("Cookie", owner));
    check("POST /chats/:chatId/stop", await request(t.app).post(`/chats/${chatId}/stop`).set("Cookie", stranger));
  });
});

describe("streaming", () => {
  it("GET /chats/:chatId/stream · 200 event stream, 401 and 404", async () => {
    const t = buildTestApp();
    const chatId = await createChatVia(t.app, "owner");
    check("GET /chats/:chatId/stream", await openStream(t, chatId, "owner"));
    check("GET /chats/:chatId/stream", await request(t.app).get(`/chats/${chatId}/stream`));
    check("GET /chats/:chatId/stream", await request(t.app).get(`/chats/${chatId}/stream`).set("Cookie", stranger));
  });
});

describe("attachments", () => {
  it("POST /chats/:chatId/messages/:messageId/attachments · 201, 400, 404 and 422", async () => {
    const t = buildTestApp();
    const chatId = await createChatVia(t.app, "owner");
    const message = await t.messagesRepo.create({ chatId, ownerId: "owner", authorEmail: "owner@example.com", role: "user", content: "hi", status: "sent" });
    const path = `/chats/${chatId}/messages/${message.id}/attachments`;
    const upload = (cookie: string[], body: string, filename: string, contentType: string) =>
      request(t.app).post(path).set("Cookie", cookie).attach("file", Buffer.from(body), { filename, contentType });
    const route = "POST /chats/:chatId/messages/:messageId/attachments";
    check(route, await upload(owner, "hello", "notes.txt", "text/plain"));
    check(route, await upload(owner, "MZ", "tool.exe", "application/octet-stream"));
    check(route, await upload(owner, "png", "image.png", "image/png")); // the fake model has no vision: 422
    check(route, await upload(stranger, "hello", "notes.txt", "text/plain"));
    check(route, await request(t.app).post(path).set("Cookie", owner));
  });
});

describe("internal routes (service token)", () => {
  it("POST /internal/erasures · 200, 400 and 401", async () => {
    const { app } = buildTestApp();
    check("POST /internal/erasures", await request(app).post("/internal/erasures").set("Authorization", service).send({ userId: "u-1", email: "u1@example.com" }));
    check("POST /internal/erasures", await request(app).post("/internal/erasures").set("Authorization", service).send({ userId: "" }));
    check("POST /internal/erasures", await request(app).post("/internal/erasures").set("Cookie", owner).send({ userId: "u-1", email: "u1@example.com" }));
  });

  it("POST /internal/sessions/:userId/stop · 200 and 401", async () => {
    const { app } = buildTestApp();
    check("POST /internal/sessions/:userId/stop", await request(app).post("/internal/sessions/u-1/stop").set("Authorization", service));
    check("POST /internal/sessions/:userId/stop", await request(app).post("/internal/sessions/u-1/stop"));
  });
});

describe("coverage of the route table", () => {
  it("every route's success response was checked against its schema", () => {
    expect(uncheckedSuccesses()).toEqual([]);
  });
});
