import { describe, expect, it } from "vitest";
import { createFileCleanup } from "../attachments/index.js";
import { FakeAttachmentsRepository } from "../../test-utils/fake-attachments-repository.js";
import { StubErasureRepository } from "../../test-utils/fake-erasure-repository.js";
import { FakeMessagesRepository } from "../../test-utils/fake-messages-repository.js";
import { FakeStorage } from "../../test-utils/fake-storage.js";
import { ErasureService } from "./service.js";

function setup() {
  const repo = new StubErasureRepository();
  const storage = new FakeStorage();
  const files = createFileCleanup(new FakeMessagesRepository(), new FakeAttachmentsRepository(), storage);
  return { repo, storage, service: new ErasureService(repo, files) };
}

describe("ErasureService", () => {
  it("removes the files of the deleted rows and reports the counts", async () => {
    const { repo, storage, service } = setup();
    const a = await storage.save(Buffer.from("a"), ".txt");
    const b = await storage.save(Buffer.from("b"), ".txt");
    repo.result = { chats: 1, memberships: 2, messages: 3, storagePaths: [a, b] };

    const summary = await service.eraseUser("u1", "u1@example.com");

    expect(summary).toEqual({ chats: 1, memberships: 2, messages: 3, files: 2 });
    expect(storage.count).toBe(0);
  });

  it("keeps every file when the database part fails", async () => {
    const { repo, storage, service } = setup();
    await storage.save(Buffer.from("a"), ".txt");
    repo.failWith = new Error("down");

    await expect(service.eraseUser("u1", "u1@example.com")).rejects.toThrow("down");

    expect(storage.count).toBe(1);
  });

  it("is a success for a user with nothing left", async () => {
    const { service } = setup();
    expect(await service.eraseUser("gone", "gone@example.com")).toEqual({ chats: 0, memberships: 0, messages: 0, files: 0 });
  });
});
