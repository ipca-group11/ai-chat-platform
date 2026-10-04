/**
 * Account erasure against a real Postgres and a real upload directory (AICHAT-130): what the
 * internal erasure endpoint deletes, what it leaves alone, and that repeating it is harmless.
 */
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createFileCleanup, createAttachmentsRepository, createFileSystemStorage } from "../features/attachments/index.js";
import { createErasureRepository, ErasureService } from "../features/erasure/index.js";
import { createMessagesRepository } from "../features/messages/index.js";
import { PrismaClient } from "../generated/prisma-client/index.js";

const prisma = new PrismaClient();
let uploadDir: string;

const exists = (file: string) => access(file).then(() => true, () => false);

function service() {
  const storage = createFileSystemStorage(uploadDir);
  const files = createFileCleanup(createMessagesRepository(prisma), createAttachmentsRepository(prisma), storage);
  return new ErasureService(createErasureRepository(prisma), files);
}

async function file(name: string): Promise<string> {
  const storagePath = path.join(uploadDir, name);
  await writeFile(storagePath, `contents of ${name}`);
  return storagePath;
}

async function message(chatId: string, ownerId: string, authorEmail: string | null, role: "user" | "assistant", attachmentFile?: string) {
  return prisma.message.create({
    data: {
      chatId,
      ownerId,
      authorEmail,
      role,
      content: `${role} by ${ownerId}`,
      ...(attachmentFile
        ? { attachments: { create: { ownerId, filename: "f.txt", mimeType: "text/plain", size: 1, kind: "text", storagePath: attachmentFile } } }
        : {}),
    },
  });
}

/** Ana and Ben. Ana owns "ana-chat" shared with Ben. Ben owns "ben-chat" shared with Ana. */
async function seed() {
  const anaChat = await prisma.chat.create({ data: { ownerId: "ana", ownerEmail: "ana@example.test", title: "Ana", provider: "openai", model: "m" } });
  const benChat = await prisma.chat.create({ data: { ownerId: "ben", ownerEmail: "ben@example.test", title: "Ben", provider: "openai", model: "m" } });
  await prisma.chatMember.create({ data: { chatId: anaChat.id, email: "ben@example.test", invitedBy: "ana" } });
  await prisma.chatMember.create({ data: { chatId: benChat.id, email: "ana@example.test", invitedBy: "ben" } });

  const files = {
    anaInAnaChat: await file("ana-in-ana-chat.txt"),
    benInAnaChat: await file("ben-in-ana-chat.txt"),
    anaInBenChat: await file("ana-in-ben-chat.txt"),
    benInBenChat: await file("ben-in-ben-chat.txt"),
  };
  await message(anaChat.id, "ana", "ana@example.test", "user", files.anaInAnaChat);
  await message(anaChat.id, "ben", "ben@example.test", "user", files.benInAnaChat);
  await message(anaChat.id, "ana", null, "assistant");
  await message(benChat.id, "ana", "ana@example.test", "user", files.anaInBenChat);
  await message(benChat.id, "ben", "ben@example.test", "user", files.benInBenChat);
  await message(benChat.id, "ben", null, "assistant");
  return { anaChat, benChat, files };
}

beforeEach(async () => {
  await prisma.chat.deleteMany(); // cascades to every other table
  uploadDir = await mkdtemp(path.join(tmpdir(), "erasure-db-"));
});

afterAll(async () => {
  await prisma.$disconnect();
  await rm(uploadDir, { recursive: true, force: true });
});

describe("erasing a user in conversation-service", () => {
  it("deletes the chats they own, for everyone, with messages, attachments and files", async () => {
    const { anaChat, files } = await seed();

    const summary = await service().eraseUser("ana", "ana@example.test");

    expect(await prisma.chat.findUnique({ where: { id: anaChat.id } })).toBeNull();
    expect(await prisma.message.count({ where: { chatId: anaChat.id } })).toBe(0);
    expect(await prisma.chatMember.count({ where: { chatId: anaChat.id } })).toBe(0);
    expect(await exists(files.anaInAnaChat)).toBe(false);
    expect(await exists(files.benInAnaChat)).toBe(false); // Ben's file lived in Ana's chat, which is gone
    expect(summary.chats).toBe(1);
  });

  it("removes their membership, messages, attachments and files in other users' chats, and leaves the rest", async () => {
    const { benChat, files } = await seed();

    await service().eraseUser("ana", "ana@example.test");

    // Ana's traces in Ben's chat are gone ...
    expect(await prisma.chatMember.count({ where: { chatId: benChat.id, email: "ana@example.test" } })).toBe(0);
    expect(await prisma.message.count({ where: { chatId: benChat.id, ownerId: "ana" } })).toBe(0);
    expect(await prisma.attachment.count({ where: { storagePath: files.anaInBenChat } })).toBe(0);
    expect(await exists(files.anaInBenChat)).toBe(false);
    // ... and Ben's chat, his message, the assistant reply and his file are intact.
    expect(await prisma.chat.findUnique({ where: { id: benChat.id } })).not.toBeNull();
    expect(await prisma.message.count({ where: { chatId: benChat.id } })).toBe(2);
    expect(await prisma.attachment.count({ where: { storagePath: files.benInBenChat } })).toBe(1);
    expect(await exists(files.benInBenChat)).toBe(true);
  });

  it("leaves no row that references the user's id or email", async () => {
    await seed();

    await service().eraseUser("ana", "ana@example.test");

    expect(await prisma.chat.count({ where: { OR: [{ ownerId: "ana" }, { ownerEmail: "ana@example.test" }] } })).toBe(0);
    expect(await prisma.chatMember.count({ where: { OR: [{ email: "ana@example.test" }, { invitedBy: "ana" }] } })).toBe(0);
    expect(await prisma.message.count({ where: { OR: [{ ownerId: "ana" }, { authorEmail: "ana@example.test" }] } })).toBe(0);
    expect(await prisma.attachment.count({ where: { ownerId: "ana" } })).toBe(0);
  });

  it("matches the email case-insensitively", async () => {
    const { benChat } = await seed();

    await service().eraseUser("ana", "ANA@Example.test");

    expect(await prisma.chatMember.count({ where: { chatId: benChat.id, email: "ana@example.test" } })).toBe(0);
  });

  it("can be repeated: the second run finds nothing and succeeds", async () => {
    const { benChat } = await seed();
    await service().eraseUser("ana", "ana@example.test");

    const again = await service().eraseUser("ana", "ana@example.test");

    expect(again).toEqual({ chats: 0, memberships: 0, messages: 0, files: 0 });
    expect(await prisma.chat.findUnique({ where: { id: benChat.id } })).not.toBeNull();
  });

  it("deletes the rows even when a file is already gone", async () => {
    const { anaChat, files } = await seed();
    await rm(files.anaInAnaChat);

    await service().eraseUser("ana", "ana@example.test");

    expect(await prisma.chat.findUnique({ where: { id: anaChat.id } })).toBeNull();
    expect(await exists(files.benInAnaChat)).toBe(false);
  });

  it("does not touch a user who has no data", async () => {
    const { anaChat } = await seed();

    const summary = await service().eraseUser("nobody", "nobody@example.test");

    expect(summary).toEqual({ chats: 0, memberships: 0, messages: 0, files: 0 });
    expect(await prisma.chat.findUnique({ where: { id: anaChat.id } })).not.toBeNull();
  });
});
