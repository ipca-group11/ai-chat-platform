/** Uploaded files are removed when the chat or the message that owns them is deleted (AICHAT-97). */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { cookieFor } from "../test-utils/auth-token.js";
import { buildTestApp, createChatVia } from "../test-utils/build-test-app.js";

async function chatWithFile(options: Parameters<typeof buildTestApp>[0] = {}) {
  const t = buildTestApp(options);
  const chatId = await createChatVia(t.app, "user-1");
  const message = await t.messagesRepo.create({ chatId, ownerId: "user-1", authorEmail: "user-1@example.com", role: "user", content: "hi", status: "sent" });
  const upload = await request(t.app)
    .post(`/chats/${chatId}/messages/${message.id}/attachments`)
    .set("Cookie", cookieFor("user-1"))
    .attach("file", Buffer.from("private notes"), { filename: "notes.txt", contentType: "text/plain" })
    .expect(201);
  const [record] = t.attachmentsRepo.all();
  return { ...t, chatId, messageId: message.id, attachmentId: (upload.body as { attachment: { id: string } }).attachment.id, storagePath: record!.storagePath };
}

describe("file cleanup on delete", () => {
  it("removes the files of a chat when the chat is deleted", async () => {
    const { app, chatId, storage, storagePath } = await chatWithFile();
    expect(storage.has(storagePath)).toBe(true);

    await request(app).delete(`/chats/${chatId}`).set("Cookie", cookieFor("user-1")).expect(204);

    expect(storage.has(storagePath)).toBe(false);
  });

  it("keeps the files when the database delete fails, so nothing is lost by half", async () => {
    const t = await chatWithFile();
    const failing = Object.assign(Object.create(Object.getPrototypeOf(t.chatsRepo)), t.chatsRepo, {
      delete: () => Promise.reject(new Error("database is down")),
    });
    const app = buildTestApp({ overrides: { chatsRepo: failing, messagesRepo: t.messagesRepo, attachmentsRepo: t.attachmentsRepo, storage: t.storage } }).app;

    await request(app).delete(`/chats/${t.chatId}`).set("Cookie", cookieFor("user-1")).expect(500);

    expect(t.storage.has(t.storagePath)).toBe(true);
  });

  it("deletes the chat even when a file is already gone", async () => {
    const { app, chatId, chatsRepo, storage, storagePath } = await chatWithFile();
    // The file was removed by something else (a volume restore, a manual cleanup).
    await storage.delete(storagePath);

    await request(app).delete(`/chats/${chatId}`).set("Cookie", cookieFor("user-1")).expect(204);

    expect(chatsRepo.has(chatId)).toBe(false);
  });

  it("removes the files of a queued message when it is canceled", async () => {
    const { app, chatId, storage, attachmentsRepo } = await chatWithFile();
    // The first message occupies the queue, the second one stays queued and can be canceled.
    await request(app).post(`/chats/${chatId}/messages`).set("Cookie", cookieFor("user-1")).send({ content: "first" }).expect(201);
    const queued = await request(app).post(`/chats/${chatId}/messages`).set("Cookie", cookieFor("user-1")).send({ content: "second" }).expect(201);
    const queuedId = (queued.body as { message: { id: string } }).message.id;
    await request(app)
      .post(`/chats/${chatId}/messages/${queuedId}/attachments`)
      .set("Cookie", cookieFor("user-1"))
      .attach("file", Buffer.from("second file"), { filename: "second.txt", contentType: "text/plain" })
      .expect(201);
    const [, secondRecord] = attachmentsRepo.all();

    await request(app).delete(`/chats/${chatId}/messages/${queuedId}`).set("Cookie", cookieFor("user-1")).expect(204);

    expect(storage.has(secondRecord!.storagePath)).toBe(false);
    expect(storage.count).toBe(1); // the chat's first file is untouched
  });
});
