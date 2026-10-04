/** An unexpected failure behind any router answers with a safe 500 (AICHAT-125): the
 * standard error body, a correlation id, and nothing of the underlying error. */
import request from "supertest";
import { describe, expect, it } from "vitest";
import type { AttachmentsRepository } from "../features/attachments/index.js";
import type { ChatsRepository } from "../features/chats/index.js";
import type { MessagesRepository } from "../features/messages/index.js";
import { cookieFor } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia } from "../test-utils/build-test-app.js";
import { expectSafe500 } from "../test-utils/expect-safe-500.js";
import { throwingRepository } from "../test-utils/throwing-repository.js";

describe("unexpected errors", () => {
  it("chats router: GET /chats returns a safe 500 when the repository fails", async () => {
    const { app } = buildTestApp({ overrides: { chatsRepo: throwingRepository<ChatsRepository>() } });
    const res = await request(app).get("/chats").set("Cookie", cookieFor("user-1")).set("X-Correlation-Id", "corr-500");
    expectSafe500(res);
    expect(res.body.correlationId).toBe("corr-500");
  });

  it("messages router: GET /chats/:chatId/messages returns a safe 500 when the message repository fails", async () => {
    const { app } = buildTestApp({ overrides: { messagesRepo: throwingRepository<MessagesRepository>() } });
    const chatId = await createChatVia(app, "user-1");
    expectSafe500(await request(app).get(`/chats/${chatId}/messages`).set("Cookie", cookieFor("user-1")));
  });

  it("streaming router: GET /chats/:chatId/stream returns a safe 500 when the access check fails", async () => {
    const { app } = buildTestApp({ overrides: { chatsRepo: throwingRepository<ChatsRepository>() } });
    expectSafe500(await request(app).get("/chats/any/stream").set("Cookie", cookieFor("user-1")));
  });

  it("attachments router: POST …/attachments returns a safe 500 when saving the record fails", async () => {
    const { app, messagesRepo } = buildTestApp({ overrides: { attachmentsRepo: throwingRepository<AttachmentsRepository>() } });
    const chatId = await createChatVia(app, "user-1");
    const message = await messagesRepo.create({ chatId, ownerId: "user-1", role: "user", content: "hi", status: "sent" });
    const res = await request(app)
      .post(`/chats/${chatId}/messages/${message.id}/attachments`)
      .set("Cookie", cookieFor("user-1"))
      .attach("file", Buffer.from("x"), { filename: "n.txt", contentType: "text/plain" });
    expectSafe500(res);
  });

  // Was a 500 (AICHAT-217): express.json() raises a 400-class SyntaxError the handler did not know.
  it("a body that is not valid JSON returns 400 VALIDATION_ERROR with the correlation id and leaks nothing", async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post("/chats")
      .set("Cookie", cookieFor("user-1"))
      .set("Content-Type", "application/json")
      .set("X-Correlation-Id", "corr-bad-json")
      .send('{"title":"secret plans",');
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({ code: "VALIDATION_ERROR", message: "Request body is not valid JSON" });
    expect(res.body.correlationId).toBe("corr-bad-json");
    expect(res.headers["x-correlation-id"]).toBe("corr-bad-json");
    expect(JSON.stringify(res.body)).not.toMatch(/Unexpected|SyntaxError|secret plans|at /);
  });

  it("malformed JSON is a 400 on the other JSON routes too", async () => {
    const { app } = buildTestApp();
    const chatId = await createChatVia(app, "user-1");
    for (const [method, path] of [
      ["post", `/chats/${chatId}/messages`],
      ["patch", `/chats/${chatId}`],
      ["post", "/internal/erasures"],
    ] as const) {
      const res = await request(app)[method](path).set("Cookie", cookieFor("user-1")).set("Content-Type", "application/json").send("{not json");
      expect(res.status, path).toBe(400);
      expect(res.body.error.code, path).toBe("VALIDATION_ERROR");
    }
  });
});
