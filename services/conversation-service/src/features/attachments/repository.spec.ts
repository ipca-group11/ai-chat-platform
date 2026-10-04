import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../shared/prisma.js";
import { createAttachmentsRepository } from "./service.js";

function mockPrisma() {
  return {
    attachment: {
      create: vi.fn().mockResolvedValue({ id: "a1" }),
      findMany: vi.fn().mockResolvedValue([{ id: "a1" }]),
    },
  } as unknown as PrismaClient;
}

describe("createAttachmentsRepository", () => {
  it("AC-66: create delegates to prisma.attachment.create", async () => {
    const prisma = mockPrisma();
    const repo = createAttachmentsRepository(prisma);
    const data = {
      messageId: "m1",
      ownerId: "u1",
      filename: "a.txt",
      mimeType: "text/plain",
      size: 1,
      kind: "text" as const,
      storagePath: "/tmp/a.txt",
      extractedText: "hi",
    };
    await repo.create(data);
    expect(prisma.attachment.create).toHaveBeenCalledWith({ data });
  });

  it("AC-69: findManyByMessageIds queries prisma when given ids", async () => {
    const prisma = mockPrisma();
    const repo = createAttachmentsRepository(prisma);
    await repo.findManyByMessageIds(["m1", "m2"]);
    expect(prisma.attachment.findMany).toHaveBeenCalledWith({ where: { messageId: { in: ["m1", "m2"] } } });
  });

  it("AC-69: findManyByMessageIds short-circuits to an empty array for no ids", async () => {
    const prisma = mockPrisma();
    const repo = createAttachmentsRepository(prisma);
    const result = await repo.findManyByMessageIds([]);
    expect(result).toEqual([]);
    expect(prisma.attachment.findMany).not.toHaveBeenCalled();
  });

  it("AICHAT-245: linkToMessage links only the owner's unsent uploads of the chat", async () => {
    const prisma = {
      attachment: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([{ id: "a1", messageId: "m1" }]),
      },
    } as unknown as PrismaClient;
    const repo = createAttachmentsRepository(prisma);

    const linked = await repo.linkToMessage(["a1", "a2"], { chatId: "c1", ownerId: "u1", messageId: "m1" });

    expect(prisma.attachment.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a1", "a2"] }, chatId: "c1", ownerId: "u1", messageId: null },
      data: { messageId: "m1" },
    });
    expect(prisma.attachment.findMany).toHaveBeenCalledWith({ where: { id: { in: ["a1", "a2"] }, messageId: "m1" } });
    expect(linked).toEqual([{ id: "a1", messageId: "m1" }]);
  });

  it("AICHAT-245: linkToMessage does nothing for no ids", async () => {
    const prisma = mockPrisma();
    const repo = createAttachmentsRepository(prisma);
    expect(await repo.linkToMessage([], { chatId: "c1", ownerId: "u1", messageId: "m1" })).toEqual([]);
    expect(prisma.attachment.findMany).not.toHaveBeenCalled();
  });
});
