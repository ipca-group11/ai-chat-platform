/** Attachment upload error paths (AICHAT-111), through the whole app. */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { cookieFor } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia, inviteVia } from "../test-utils/build-test-app.js";
import { fakeProvider, fakeProviderRegistry } from "../test-utils/fake-provider-registry.js";
import { pngFile } from "../test-utils/file-fixtures.js";

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

const png = (bytes: number) => Buffer.concat([pngFile(), Buffer.alloc(Math.max(0, bytes - pngFile().length), 1)]);

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

  // Multer stops reading at the limit itself (AICHAT-254), so a much larger body is cut
  // off rather than buffered; still a 413 (AICHAT-218).
  it("413 ATTACHMENT_TOO_LARGE for a file far over the limit", async () => {
    const { app, path, attachmentsRepo } = await setup();
    const res = await request(app).post(path).set("Cookie", cookieFor("user-1")).attach("file", Buffer.alloc(SMALL_LIMIT * 50, 1), { filename: "huge.txt", contentType: "text/plain" });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("ATTACHMENT_TOO_LARGE");
    expect(attachmentsRepo.all()).toHaveLength(0);
  });

  // AICHAT-254 (pentest H6): the name and MIME type are the client's; the bytes decide.
  it.each([
    ["HTML posing as a PNG", Buffer.from("<html><script>alert(1)</script></html>"), "x.png", "image/png"],
    ["a PNG posing as a JPEG", pngFile(), "x.jpg", "image/jpeg"],
    ["a Windows executable posing as a PDF", Buffer.from("MZ\x90\x00\x03\x00\x00\x00", "latin1"), "x.pdf", "application/pdf"],
    ["binary data posing as text", Buffer.from([0x68, 0x69, 0x00, 0x01]), "x.txt", "text/plain"],
    ["invalid UTF-8 posing as text", Buffer.from([0xc3, 0x28, 0xa0, 0xa1]), "x.txt", "text/plain"],
  ])("400 ATTACHMENT_TYPE_NOT_ALLOWED for %s, and nothing is stored", async (_label, body, filename, contentType) => {
    const { app, path, attachmentsRepo, storage } = await setup();
    const res = await request(app).post(path).set("Cookie", cookieFor("user-1")).attach("file", body, { filename, contentType });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("ATTACHMENT_TYPE_NOT_ALLOWED");
    expect(attachmentsRepo.all()).toHaveLength(0);
    expect(storage.count).toBe(0);
  });

  it("400 ATTACHMENT_IMAGE_TOO_LARGE for a small PNG that declares a huge canvas", async () => {
    const { app, path, attachmentsRepo } = await setup();
    const res = await request(app).post(path).set("Cookie", cookieFor("user-1")).attach("file", pngFile(60_000, 60_000), { filename: "bomb.png", contentType: "image/png" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("ATTACHMENT_IMAGE_TOO_LARGE");
    expect(attachmentsRepo.all()).toHaveLength(0);
  });

  it("400 ATTACHMENT_UPLOAD_ERROR for more than one file in a request", async () => {
    const { app, path, attachmentsRepo } = await setup();
    const res = await request(app)
      .post(path)
      .set("Cookie", cookieFor("user-1"))
      .attach("file", Buffer.from("a"), { filename: "a.txt", contentType: "text/plain" })
      .attach("file", Buffer.from("b"), { filename: "b.txt", contentType: "text/plain" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("ATTACHMENT_UPLOAD_ERROR");
    expect(attachmentsRepo.all()).toHaveLength(0);
  });
});
