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

  // Pinned current behaviour (defect, WORKLOG §7): a body that is not valid JSON makes
  // express.json() raise a 400-class SyntaxError, which the error handler does not know,
  // so the client gets a 500 instead of a 400. Fixing it needs a new branch in the handler.
  it("a body that is not valid JSON returns 500 (pinned: should be 400) and still leaks nothing", async () => {
    const { app } = buildTestApp();
    const res = await request(app)
      .post("/chats")
      .set("Cookie", cookieFor("user-1"))
      .set("Content-Type", "application/json")
      .send("{not json");
    expectSafe500(res);
  });
});
