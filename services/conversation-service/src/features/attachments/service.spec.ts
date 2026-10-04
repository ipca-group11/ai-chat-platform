import { describe, expect, it } from "vitest";
import { FakeAttachmentsRepository } from "../../test-utils/fake-attachments-repository.js";
import { FakeChatsRepository } from "../../test-utils/fake-chats-repository.js";
import { FakeMessagesRepository } from "../../test-utils/fake-messages-repository.js";
import { fakeProvider, fakeProviderRegistry } from "../../test-utils/fake-provider-registry.js";
import { FakeStorage } from "../../test-utils/fake-storage.js";
import { HttpError } from "../../shared/error-handler.js";
import { ChatsService } from "../chats/index.js";
import { AttachmentsService } from "./service.js";
import { asUser } from "../../test-utils/principal.js";

const ONE_MB = 1024 * 1024;

async function setup(options: { supportsVision?: boolean; maxBytes?: number } = {}) {
  const chatsRepo = new FakeChatsRepository();
  const chatsService = new ChatsService(chatsRepo);
  const messagesRepo = new FakeMessagesRepository();
  const attachmentsRepo = new FakeAttachmentsRepository();
  const storage = new FakeStorage();
  const providerRegistry = fakeProviderRegistry(fakeProvider({ id: "openai", vision: options.supportsVision ?? true }));
  const service = new AttachmentsService(
    attachmentsRepo,
    chatsService,
    messagesRepo,
    storage,
    providerRegistry,
    options.maxBytes ?? 10 * ONE_MB,
  );

  const chat = await chatsService.create(asUser("user-1"), { title: "Chat", provider: "openai", model: "gpt-4o" });
  const message = await messagesRepo.create({ chatId: chat.id, ownerId: "user-1", role: "user", content: "hi", status: "sent" });

  return { chatsService, messagesRepo, attachmentsRepo, storage, service, chat, message };
}

describe("AttachmentsService", () => {
  it("AC-66: a user can attach a file to a message", async () => {
    const { service, chat, message } = await setup();

    const attachment = await service.upload(asUser("user-1"), chat.id, message.id, {
      originalname: "notes.txt",
      mimetype: "text/plain",
      size: 5,
      buffer: Buffer.from("hello"),
    });

    expect(attachment.filename).toBe("notes.txt");
    expect(attachment.kind).toBe("text");
  });

  it("AICHAT-245: a file uploaded before its message is sent belongs to the chat until then", async () => {
    const { service, chat, attachmentsRepo } = await setup();

    const attachment = await service.upload(asUser("user-1"), chat.id, undefined, {
      originalname: "notes.txt",
      mimetype: "text/plain",
      size: 5,
      buffer: Buffer.from("hello"),
    });

    expect(attachment.messageId).toBe("");
    expect(attachmentsRepo.all()).toMatchObject([{ id: attachment.id, chatId: chat.id, messageId: null, ownerId: "user-1" }]);
  });

  it("AC-67/68: rejects a disallowed file type with a clear message", async () => {
    const { service, chat, message } = await setup();

    await expect(
      service.upload(asUser("user-1"), chat.id, message.id, {
        originalname: "virus.exe",
        mimetype: "application/octet-stream",
        size: 5,
        buffer: Buffer.from("x"),
      }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it("AC-68: rejects a file over the configured size limit", async () => {
    const { service, chat, message } = await setup({ maxBytes: 10 });

    await expect(
      service.upload(asUser("user-1"), chat.id, message.id, {
        originalname: "big.txt",
        mimetype: "text/plain",
        size: 1000,
        buffer: Buffer.alloc(1000),
      }),
    ).rejects.toBeInstanceOf(HttpError);
  });

  it("AC-69: extracts and stores text content for .txt attachments", async () => {
    const { service, attachmentsRepo, chat, message } = await setup();

    await service.upload(asUser("user-1"), chat.id, message.id, {
      originalname: "notes.txt",
      mimetype: "text/plain",
      size: 5,
      buffer: Buffer.from("hello"),
    });

    expect(attachmentsRepo.all()[0]?.extractedText).toBe("hello");
  });

  it("AC-70: accepts an image attachment when the chat's model supports vision", async () => {
    const { service, chat, message } = await setup({ supportsVision: true });

    const attachment = await service.upload(asUser("user-1"), chat.id, message.id, {
      originalname: "photo.png",
      mimetype: "image/png",
      size: 5,
      buffer: Buffer.from([1, 2, 3]),
    });

    expect(attachment.kind).toBe("image");
  });

  it("AC-71: rejects an image attachment when the chat's model does not support vision", async () => {
    const { service, chat, message } = await setup({ supportsVision: false });

    await expect(
      service.upload(asUser("user-1"), chat.id, message.id, {
        originalname: "photo.png",
        mimetype: "image/png",
        size: 5,
        buffer: Buffer.from([1, 2, 3]),
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it("AC-66: uploading against a non-existent message is rejected with 404", async () => {
    const { service, chat } = await setup();

    await expect(
      service.upload(asUser("user-1"), chat.id, "does-not-exist", {
        originalname: "notes.txt",
        mimetype: "text/plain",
        size: 5,
        buffer: Buffer.from("hello"),
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("AC-45/46: uploading to another user's chat is rejected", async () => {
    const { service, chat, message } = await setup();

    await expect(
      service.upload(asUser("intruder"), chat.id, message.id, {
        originalname: "notes.txt",
        mimetype: "text/plain",
        size: 5,
        buffer: Buffer.from("hello"),
      }),
    ).rejects.toBeInstanceOf(HttpError);
  });
});
