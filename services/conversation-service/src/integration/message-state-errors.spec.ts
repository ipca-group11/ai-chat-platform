/** Edit, cancel and retry reject messages in the wrong state (AICHAT-93), through the whole app. */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { cookieFor } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia, inviteVia } from "../test-utils/build-test-app.js";

/** The first message of a chat is picked up by the (hanging) fake queue and is
 * "processing"; the second waits in the queue. */
async function chatWithProcessingAndQueued() {
  const t = buildTestApp();
  const chatId = await createChatVia(t.app, "user-1");
  const cookie = cookieFor("user-1");
  const first = await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", cookie).send({ content: "first" });
  const second = await request(t.app).post(`/chats/${chatId}/messages`).set("Cookie", cookie).send({ content: "second" });
  return { ...t, chatId, cookie, processingId: first.body.message.id as string, queuedId: second.body.message.id as string };
}

describe("PATCH /chats/:chatId/messages/:messageId errors", () => {
  it("409 MESSAGE_NOT_EDITABLE once the message is being processed", async () => {
    const { app, chatId, cookie, processingId } = await chatWithProcessingAndQueued();
    const res = await request(app).patch(`/chats/${chatId}/messages/${processingId}`).set("Cookie", cookie).send({ content: "late edit" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("MESSAGE_NOT_EDITABLE");
  });

  it("404 MESSAGE_NOT_FOUND for an unknown message id", async () => {
    const { app, chatId, cookie } = await chatWithProcessingAndQueued();
    const res = await request(app).patch(`/chats/${chatId}/messages/does-not-exist`).set("Cookie", cookie).send({ content: "x" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("MESSAGE_NOT_FOUND");
  });

  it("404 MESSAGE_NOT_FOUND when a member edits a message written by someone else", async () => {
    const { app, chatId, queuedId } = await chatWithProcessingAndQueued();
    await inviteVia(app, "user-1", chatId, "guest@example.com");
    const res = await request(app).patch(`/chats/${chatId}/messages/${queuedId}`).set("Cookie", cookieFor("guest")).send({ content: "x" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("MESSAGE_NOT_FOUND");
  });

  it("400 VALIDATION_ERROR for an empty or missing content", async () => {
    const { app, chatId, cookie, queuedId } = await chatWithProcessingAndQueued();
    for (const body of [{ content: "   " }, {}]) {
      const res = await request(app).patch(`/chats/${chatId}/messages/${queuedId}`).set("Cookie", cookie).send(body);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("DELETE /chats/:chatId/messages/:messageId errors", () => {
  it("409 MESSAGE_NOT_CANCELABLE once the message is being processed, and it is kept", async () => {
    const { app, messagesRepo, chatId, cookie, processingId } = await chatWithProcessingAndQueued();
    const res = await request(app).delete(`/chats/${chatId}/messages/${processingId}`).set("Cookie", cookie);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("MESSAGE_NOT_CANCELABLE");
    expect(messagesRepo.has(processingId)).toBe(true);
  });

  it("404 MESSAGE_NOT_FOUND for an unknown message id", async () => {
    const { app, chatId, cookie } = await chatWithProcessingAndQueued();
    const res = await request(app).delete(`/chats/${chatId}/messages/does-not-exist`).set("Cookie", cookie);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("MESSAGE_NOT_FOUND");
  });
});

describe("POST /chats/:chatId/messages/:messageId/retry errors", () => {
  it("409 MESSAGE_NOT_RETRYABLE for a message that has not failed", async () => {
    const { app, chatId, cookie, processingId } = await chatWithProcessingAndQueued();
    const res = await request(app).post(`/chats/${chatId}/messages/${processingId}/retry`).set("Cookie", cookie);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("MESSAGE_NOT_RETRYABLE");
  });

  it("404 MESSAGE_NOT_FOUND for a failed message that belongs to another chat", async () => {
    const t = await chatWithProcessingAndQueued();
    const otherChat = await createChatVia(t.app, "user-1");
    const failed = await t.messagesRepo.create({ chatId: otherChat, ownerId: "user-1", role: "assistant", content: "", status: "failed" });
    const res = await request(t.app).post(`/chats/${t.chatId}/messages/${failed.id}/retry`).set("Cookie", t.cookie);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("MESSAGE_NOT_FOUND");
  });

  // AICHAT-219: same as edit and cancel.
  it("404 MESSAGE_NOT_FOUND for an unknown message id", async () => {
    const { app, chatId, cookie } = await chatWithProcessingAndQueued();
    const res = await request(app).post(`/chats/${chatId}/messages/does-not-exist/retry`).set("Cookie", cookie);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("MESSAGE_NOT_FOUND");
  });

  it("404 CHAT_NOT_FOUND for an unknown chat", async () => {
    const { app, cookie } = await chatWithProcessingAndQueued();
    const res = await request(app).post("/chats/does-not-exist/messages/x/retry").set("Cookie", cookie);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CHAT_NOT_FOUND");
  });
});
