/** Attachment upload error paths (AICHAT-111), through the whole app. */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { cookieFor } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia, inviteVia } from "../test-utils/build-test-app.js";
import { fakeProvider, fakeProviderRegistry } from "../test-utils/fake-provider-registry.js";

const SMALL_LIMIT = 1024;

async function setup(vision = true) {
  const t = buildTestApp({
    maxUploadBytes: SMALL_LIMIT,
    overrides: { providerRegistry: fakeProviderRegistry(fakeProvider({ vision })) },
  });
  const chatId = await createChatVia(t.app, "user-1");
  const message = await t.messagesRepo.create({ chatId, ownerId: "user-1", authorEmail: "user-1@example.com", role: "user", content: "hi", status: "sent" });
  return { ...t, chatId, messageId: message.id, path: `/chats/${chatId}/messages/${message.id}/attachments` };
}

const png = (bytes: number) => Buffer.alloc(bytes, 1);

describe("POST /chats/:chatId/messages/:messageId/attachments errors", () => {
  it("404 MESSAGE_NOT_FOUND for an unknown message id", async () => {
    const { app, chatId } = await setup();
    const res = await request(app)
      .post(`/chats/${chatId}/messages/does-not-exist/attachments`)
      .set("Cookie", cookieFor("user-1"))
      .attach("file", Buffer.from("x"), { filename: "n.txt", contentType: "text/plain" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("MESSAGE_NOT_FOUND");
  });

  it("422 ATTACHMENT_NOT_SUPPORTED for an image when the chat's model has no vision", async () => {
    const { app, path, attachmentsRepo } = await setup(false);
    const res = await request(app).post(path).set("Cookie", cookieFor("user-1")).attach("file", png(10), { filename: "p.png", contentType: "image/png" });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("ATTACHMENT_NOT_SUPPORTED");
    expect(attachmentsRepo.all()).toHaveLength(0);
  });

  it("201 for the same image when the model supports vision", async () => {
    const { app, path } = await setup(true);
    const res = await request(app).post(path).set("Cookie", cookieFor("user-1")).attach("file", png(10), { filename: "p.png", contentType: "image/png" });
    expect(res.status).toBe(201);
    expect(res.body.attachment.kind).toBe("image");
  });

  it("404 CHAT_NOT_FOUND when another user uploads to the chat, and nothing is stored", async () => {
    const { app, path, attachmentsRepo } = await setup();
    const res = await request(app).post(path).set("Cookie", cookieFor("user-2")).attach("file", Buffer.from("x"), { filename: "n.txt", contentType: "text/plain" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("CHAT_NOT_FOUND");
    expect(attachmentsRepo.all()).toHaveLength(0);
  });

  it("404 MESSAGE_NOT_FOUND when a member uploads to a message written by the owner", async () => {
    const { app, chatId, path } = await setup();
    await inviteVia(app, "user-1", chatId, "guest@example.com");
    const res = await request(app).post(path).set("Cookie", cookieFor("guest")).attach("file", Buffer.from("x"), { filename: "n.txt", contentType: "text/plain" });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("MESSAGE_NOT_FOUND");
  });

  // AICHAT-218: 413 Payload Too Large, as the acceptance criterion expects.
  it("413 ATTACHMENT_TOO_LARGE for a file over the configured limit", async () => {
    const { app, path, attachmentsRepo } = await setup();
    const res = await request(app).post(path).set("Cookie", cookieFor("user-1")).attach("file", Buffer.alloc(SMALL_LIMIT + 1, 1), { filename: "big.txt", contentType: "text/plain" });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("ATTACHMENT_TOO_LARGE");
    expect(attachmentsRepo.all()).toHaveLength(0);
  });

  // Above the hard ceiling multer stops the upload first; still a 413 (AICHAT-218).
  it("413 ATTACHMENT_TOO_LARGE for a file over the hard ceiling", async () => {
    const { app, path, attachmentsRepo } = await setup();
    const res = await request(app).post(path).set("Cookie", cookieFor("user-1")).attach("file", Buffer.alloc(SMALL_LIMIT * 2 + 1, 1), { filename: "huge.txt", contentType: "text/plain" });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("ATTACHMENT_TOO_LARGE");
    expect(attachmentsRepo.all()).toHaveLength(0);
  });
});
