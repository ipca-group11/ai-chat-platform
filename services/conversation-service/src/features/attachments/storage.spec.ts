import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFileSystemStorage } from "./storage.js";

describe("createFileSystemStorage", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "conversation-service-attachments-"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("AC-66: saves a file to the upload directory and reads it back byte-for-byte", async () => {
    const storage = createFileSystemStorage(dir);
    const original = Buffer.from("hello world");

    const storagePath = await storage.save(original, ".txt");
    const readBack = await storage.read(storagePath);

    expect(readBack.equals(original)).toBe(true);
    expect(storagePath.startsWith(dir)).toBe(true);
  });

  it("AC-66: creates the upload directory if it does not already exist", async () => {
    const nested = path.join(dir, "nested", "uploads");
    const storage = createFileSystemStorage(nested);

    const storagePath = await storage.save(Buffer.from("x"), ".txt");

    expect(storagePath.startsWith(nested)).toBe(true);
  });

  it("AICHAT-97: delete removes a saved file", async () => {
    const storage = createFileSystemStorage(dir);
    const storagePath = await storage.save(Buffer.from("x"), ".txt");

    await storage.delete(storagePath);

    await expect(storage.read(storagePath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("AICHAT-97: delete is idempotent, a missing file is not an error", async () => {
    const storage = createFileSystemStorage(dir);
    const storagePath = await storage.save(Buffer.from("x"), ".txt");

    await storage.delete(storagePath);
    await expect(storage.delete(storagePath)).resolves.toBeUndefined();
  });

  it("AICHAT-97: delete refuses a path outside the upload directory", async () => {
    const storage = createFileSystemStorage(dir);
    const outside = path.join(dir, "..", "outside.txt");

    await expect(storage.delete(outside)).rejects.toThrow("outside the upload directory");
  });
});
