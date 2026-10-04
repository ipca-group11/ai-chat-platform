/**
 * Orphaned-file sweep of conversation-service against a real Postgres and a real upload directory, with
 * the clock under the test's control (AICHAT-137). File ages are set with utimes, the "now" is passed in.
 */
import { access, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createAttachmentsRepository, createFileSystemStorage } from "../features/attachments/index.js";
import { orphanFileCutoff, runRetention } from "../features/retention/index.js";
import { PrismaClient } from "../generated/prisma-client/index.js";

const prisma = new PrismaClient();
const NOW = new Date("2026-10-04T12:00:00.000Z");
const SECOND = 1000;
const HOUR = 60 * 60 * SECOND;
let uploadDir: string;

const exists = (file: string) => access(file).then(() => true, () => false);
const run = (now: Date) => runRetention(now, { storage: createFileSystemStorage(uploadDir), attachmentsRepo: createAttachmentsRepository(prisma) });

async function upload(name: string, savedAt: Date, referencedBy?: string): Promise<string> {
  const storagePath = path.join(uploadDir, name);
  await writeFile(storagePath, name);
  await utimes(storagePath, savedAt, savedAt);
  if (referencedBy) {
    const chat = await prisma.chat.create({ data: { ownerId: "u1", title: "t", provider: "openai", model: "m" } });
    const message = await prisma.message.create({ data: { chatId: chat.id, ownerId: "u1", role: "user", content: referencedBy } });
    await prisma.attachment.create({ data: { messageId: message.id, ownerId: "u1", filename: name, mimeType: "text/plain", size: 1, kind: "text", storagePath } });
  }
  return storagePath;
}

beforeEach(async () => {
  await prisma.chat.deleteMany();
  uploadDir = await mkdtemp(path.join(tmpdir(), "retention-db-"));
});

afterAll(async () => {
  await prisma.$disconnect();
  await rm(uploadDir, { recursive: true, force: true });
});

describe("orphaned upload files: removed after 24 hours", () => {
  const limit = orphanFileCutoff(NOW);

  it.each([
    ["1 second before the limit (23 h 59 min 59 s old)", new Date(limit.getTime() + SECOND), true],
    ["exactly at the limit (24 h old)", limit, true],
    ["1 second after the limit (24 h 1 s old)", new Date(limit.getTime() - SECOND), false],
    ["just uploaded", NOW, true],
  ])("an unreferenced file %s -> kept: %s", async (_label, savedAt, kept) => {
    const file = await upload("orphan.txt", savedAt);

    await run(NOW);

    expect(await exists(file)).toBe(kept);
  });

  it("never removes a file an attachment row points to, however old", async () => {
    const file = await upload("referenced.txt", new Date(NOW.getTime() - 400 * 24 * HOUR), "keep me");

    const result = await run(NOW);

    expect(result.orphansDeleted).toBe(0);
    expect(await exists(file)).toBe(true);
  });

  it("follows the clock: the same file survives an earlier run and goes in a later one", async () => {
    const file = await upload("orphan.txt", new Date(limit.getTime() - SECOND));

    await run(new Date(NOW.getTime() - 60 * SECOND));
    expect(await exists(file)).toBe(true);

    await run(NOW);
    expect(await exists(file)).toBe(false);
  });

  it("is idempotent, and only removes the orphans among a mix of files", async () => {
    const old = new Date(NOW.getTime() - 48 * HOUR);
    const orphans = [await upload("o1.txt", old), await upload("o2.txt", old)];
    const referenced = await upload("r.txt", old, "referenced");
    const young = await upload("y.txt", new Date(NOW.getTime() - HOUR));

    const first = await run(NOW);
    const second = await run(NOW);

    expect(first.orphansDeleted).toBe(2);
    expect(second).toEqual({ checked: 1, orphansDeleted: 0 }); // only the referenced old file is still looked at
    for (const file of orphans) expect(await exists(file)).toBe(false);
    expect(await exists(referenced)).toBe(true);
    expect(await exists(young)).toBe(true);
  });
});
