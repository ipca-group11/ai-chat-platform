import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../shared/prisma.js";
import { createErasureRepository } from "./repository.js";

function mockPrisma() {
  const tx = {
    attachment: {
      findMany: vi.fn().mockResolvedValue([{ storagePath: "/u/a.txt" }, { storagePath: "/u/b.txt" }]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    chat: { deleteMany: vi.fn().mockResolvedValue({ count: 2 }) },
    chatMember: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
    message: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
  };
  const prisma = { $transaction: vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) } as unknown as PrismaClient;
  return { prisma, tx };
}

describe("createErasureRepository", () => {
  it("deletes the owned chats, the memberships by lowercased email and the user's messages in one transaction", async () => {
    const { prisma, tx } = mockPrisma();

    const result = await createErasureRepository(prisma).eraseUser("u1", "U1@Example.com");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.chat.deleteMany).toHaveBeenCalledWith({ where: { ownerId: "u1" } });
    expect(tx.chatMember.deleteMany).toHaveBeenCalledWith({ where: { email: "u1@example.com" } });
    expect(tx.message.deleteMany).toHaveBeenCalledWith({ where: { ownerId: "u1" } });
    expect(result).toEqual({ chats: 2, memberships: 1, messages: 3, storagePaths: ["/u/a.txt", "/u/b.txt"] });
  });

  it("reads the file paths before anything is deleted", async () => {
    const { prisma, tx } = mockPrisma();

    await createErasureRepository(prisma).eraseUser("u1", "u1@example.com");

    const findOrder = tx.attachment.findMany.mock.invocationCallOrder[0] ?? 0;
    const deleteOrder = tx.chat.deleteMany.mock.invocationCallOrder[0] ?? 0;
    expect(findOrder).toBeLessThan(deleteOrder);
  });
});
