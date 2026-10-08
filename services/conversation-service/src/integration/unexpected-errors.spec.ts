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

  // Was pinned as a 500 (defect, AICHAT-23 WORKLOG §7); fixed in AICHAT-186: the error handler
  // now knows the body parser's 400-class errors.
  it("a body that is not valid JSON returns 400 INVALID_JSON and leaks nothing", async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post("/chats")
      .set("Cookie", cookieFor("user-1"))
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
    expect(res.body.correlationId).toBe(res.headers["x-correlation-id"]);
    expect(JSON.stringify(res.body)).not.toMatch(/Unexpected token|SyntaxError|at /);
  });
});
