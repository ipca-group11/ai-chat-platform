import { describe, expect, it, vi } from "vitest";
import { FakeAttachmentsRepository } from "../../test-utils/fake-attachments-repository.js";
import { FakeMessagesRepository } from "../../test-utils/fake-messages-repository.js";
import { FakeStorage } from "../../test-utils/fake-storage.js";
import { createFileCleanup } from "./file-cleanup.js";

async function setup() {
  const messages = new FakeMessagesRepository();
  const attachments = new FakeAttachmentsRepository();
  const storage = new FakeStorage();
  const onError = vi.fn();
  const cleanup = createFileCleanup(messages, attachments, storage, onError);

  const seed = async (chatId: string) => {
    const message = await messages.create({ chatId, ownerId: "u1", role: "user", content: "x", status: "sent" });
    const storagePath = await storage.save(Buffer.from("x"), ".txt");
    await attachments.create({ messageId: message.id, ownerId: "u1", filename: "a.txt", mimeType: "text/plain", size: 1, kind: "text", storagePath, extractedText: null });
    return { message, storagePath };
  };
  return { cleanup, storage, onError, seed };
}

describe("createFileCleanup", () => {
  it("collects the files of one chat only", async () => {
    const { cleanup, seed } = await setup();
    const a = await seed("chat-a");
    await seed("chat-b");

    expect(await cleanup.collectForChat("chat-a")).toEqual([a.storagePath]);
  });

  it("collects the files of one message only", async () => {
    const { cleanup, seed } = await setup();
    const first = await seed("chat-a");
    await seed("chat-a");

    expect(await cleanup.collectForMessage(first.message.id)).toEqual([first.storagePath]);
  });

  it("removes the files and survives one that is already gone", async () => {
    const { cleanup, storage, seed } = await setup();
    const a = await seed("chat-a");
    const b = await seed("chat-a");

    await cleanup.remove([a.storagePath, "never-existed.txt", b.storagePath]);

    expect(storage.count).toBe(0);
  });

  it("reports a file that cannot be removed and keeps removing the others", async () => {
    const { cleanup, storage, onError, seed } = await setup();
    const a = await seed("chat-a");
    const b = await seed("chat-a");
    vi.spyOn(storage, "delete").mockImplementationOnce(() => Promise.reject(new Error("EACCES")));

    await cleanup.remove([a.storagePath, b.storagePath]);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError.mock.calls[0]?.[0]).toBe(a.storagePath);
    expect(storage.has(b.storagePath)).toBe(false);
  });
});
