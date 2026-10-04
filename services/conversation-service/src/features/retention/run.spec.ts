import { describe, expect, it, vi } from "vitest";
import { FakeAttachmentsRepository } from "../../test-utils/fake-attachments-repository.js";
import { FakeStorage } from "../../test-utils/fake-storage.js";
import { orphanFileCutoff, runRetention } from "./run.js";

const NOW = new Date("2026-10-04T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

async function setup() {
  const storage = new FakeStorage();
  const attachmentsRepo = new FakeAttachmentsRepository();
  const save = async (savedAt: Date, referenced = false) => {
    const storagePath = await storage.save(Buffer.from("x"), ".txt");
    storage.setModifiedAt(storagePath, savedAt);
    if (referenced) {
      await attachmentsRepo.create({ messageId: "m1", ownerId: "u1", filename: "f.txt", mimeType: "text/plain", size: 1, kind: "text", storagePath, extractedText: null });
    }
    return storagePath;
  };
  return { storage, attachmentsRepo, save, deps: { storage, attachmentsRepo } };
}

describe("orphanFileCutoff", () => {
  it("is 24 hours before now", () => {
    expect(orphanFileCutoff(NOW).toISOString()).toBe("2026-10-03T12:00:00.000Z");
  });
});

describe("runRetention (orphaned files)", () => {
  it("removes an unreferenced file older than 24 hours", async () => {
    const { deps, save, storage } = await setup();
    const orphan = await save(new Date(NOW.getTime() - 24 * HOUR - 1000));

    const result = await runRetention(NOW, deps);

    expect(result).toEqual({ checked: 1, orphansDeleted: 1 });
    expect(storage.has(orphan)).toBe(false);
  });

  it("keeps an unreferenced file that is not yet 24 hours old, and one that is exactly 24 hours old", async () => {
    const { deps, save, storage } = await setup();
    const young = await save(new Date(NOW.getTime() - 24 * HOUR + 1000));
    const exact = await save(new Date(NOW.getTime() - 24 * HOUR));

    const result = await runRetention(NOW, deps);

    expect(result).toEqual({ checked: 0, orphansDeleted: 0 });
    expect(storage.has(young)).toBe(true);
    expect(storage.has(exact)).toBe(true);
  });

  it("keeps an old file that an attachment row still references", async () => {
    const { deps, save, storage } = await setup();
    const kept = await save(new Date(NOW.getTime() - 400 * 24 * HOUR), true);

    const result = await runRetention(NOW, deps);

    expect(result).toEqual({ checked: 1, orphansDeleted: 0 });
    expect(storage.has(kept)).toBe(true);
  });

  it("is idempotent", async () => {
    const { deps, save } = await setup();
    await save(new Date(NOW.getTime() - 30 * HOUR));

    await runRetention(NOW, deps);
    expect(await runRetention(NOW, deps)).toEqual({ checked: 0, orphansDeleted: 0 });
  });

  it("reports a file it cannot remove and carries on with the others", async () => {
    const { deps, save, storage } = await setup();
    const first = await save(new Date(NOW.getTime() - 30 * HOUR));
    const second = await save(new Date(NOW.getTime() - 30 * HOUR));
    vi.spyOn(storage, "delete").mockImplementationOnce(() => Promise.reject(new Error("EACCES")));
    const onFileError = vi.fn();

    const result = await runRetention(NOW, { ...deps, onFileError });

    expect(result.orphansDeleted).toBe(1);
    expect(onFileError).toHaveBeenCalledWith(first, expect.any(Error));
    expect(storage.has(second)).toBe(false);
  });
});
