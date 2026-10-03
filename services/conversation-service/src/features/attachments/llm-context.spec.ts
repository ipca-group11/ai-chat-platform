import { describe, expect, it } from "vitest";
import { FakeAttachmentsRepository } from "../../test-utils/fake-attachments-repository.js";
import { FakeStorage } from "../../test-utils/fake-storage.js";
import type { MessageRecord } from "../messages/index.js";
import { createAttachmentAwareContextBuilder } from "./llm-context.js";

function message(overrides: Partial<MessageRecord> = {}): MessageRecord {
  return {
    id: "m1",
    chatId: "c1",
    ownerId: "user-1",
    role: "user",
    content: "hi",
    status: "sent",
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    attachments: [],
    ...overrides,
  };
}

describe("createAttachmentAwareContextBuilder", () => {
  it("AC-69: inlines extracted text for text/PDF attachments", async () => {
    const repo = new FakeAttachmentsRepository();
    const storage = new FakeStorage();
    await repo.create({
      messageId: "m1",
      ownerId: "user-1",
      filename: "notes.txt",
      mimeType: "text/plain",
      size: 5,
      kind: "text",
      storagePath: "n/a",
      extractedText: "extracted content",
    });
    const build = createAttachmentAwareContextBuilder(repo, storage);

    const [llmMessage] = await build([message()]);

    expect(llmMessage?.attachments?.[0]).toMatchObject({ kind: "text", content: "extracted content" });
  });

  it("AC-70: base64-encodes image attachment bytes read from storage", async () => {
    const repo = new FakeAttachmentsRepository();
    const storage = new FakeStorage();
    const storagePath = await storage.save(Buffer.from([1, 2, 3]), ".png");
    await repo.create({
      messageId: "m1",
      ownerId: "user-1",
      filename: "photo.png",
      mimeType: "image/png",
      size: 3,
      kind: "image",
      storagePath,
      extractedText: null,
    });
    const build = createAttachmentAwareContextBuilder(repo, storage);

    const [llmMessage] = await build([message()]);

    expect(llmMessage?.attachments?.[0]).toMatchObject({
      kind: "image",
      content: Buffer.from([1, 2, 3]).toString("base64"),
      mimeType: "image/png",
    });
  });

  it("returns no attachments field for messages without attachments", async () => {
    const repo = new FakeAttachmentsRepository();
    const storage = new FakeStorage();
    const build = createAttachmentAwareContextBuilder(repo, storage);

    const [llmMessage] = await build([message()]);

    expect(llmMessage?.attachments).toBeUndefined();
  });
});
