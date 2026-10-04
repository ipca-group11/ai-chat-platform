import { afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../generated/prisma-client/index.js";
import { createAttachmentsRepository } from "../features/attachments/index.js";

const prisma = new PrismaClient();
afterAll(() => prisma.$disconnect());

const file = { filename: "n.txt", mimeType: "text/plain", size: 5, kind: "text" as const, extractedText: "hello" };

describe("attachments uploaded before the send (AICHAT-245)", () => {
  it("are stored without a message, linked once by the send, and go with their chat", async () => {
    const repo = createAttachmentsRepository(prisma);
    const chat = await prisma.chat.create({ data: { ownerId: "u1", title: "t", provider: "openai", model: "m" } });
    const other = await prisma.chat.create({ data: { ownerId: "u1", title: "o", provider: "openai", model: "m" } });
    const message = await prisma.message.create({ data: { chatId: chat.id, ownerId: "u1", role: "user", content: "hi" } });
    const elsewhere = await prisma.message.create({ data: { chatId: other.id, ownerId: "u1", role: "user", content: "hi" } });

    const mine = await repo.create({ ...file, messageId: null, chatId: chat.id, ownerId: "u1", storagePath: "a.txt" });
    const theirs = await repo.create({ ...file, messageId: null, chatId: chat.id, ownerId: "u2", storagePath: "b.txt" });
    expect(mine.messageId).toBeNull();

    expect(await repo.linkToMessage([mine.id], { chatId: other.id, ownerId: "u1", messageId: elsewhere.id })).toEqual([]);
    const linked = await repo.linkToMessage([mine.id, theirs.id], { chatId: chat.id, ownerId: "u1", messageId: message.id });
    expect(linked.map((a) => a.id)).toEqual([mine.id]);
    expect(await repo.findManyByMessageIds([message.id])).toMatchObject([{ id: mine.id, messageId: message.id }]);

    await prisma.chat.delete({ where: { id: chat.id } });
    expect(await prisma.attachment.count({ where: { id: { in: [mine.id, theirs.id] } } })).toBe(0);
    await prisma.chat.delete({ where: { id: other.id } });
  });
});
