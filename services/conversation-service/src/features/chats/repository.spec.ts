import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../shared/prisma.js";
import { createChatsRepository } from "./service.js";

function mockPrisma() {
  return {
    chat: {
      create: vi.fn().mockResolvedValue({ id: "c1" }),
      findMany: vi.fn().mockResolvedValue([{ id: "c1" }]),
      findFirst: vi.fn().mockResolvedValue({ id: "c1" }),
      findUnique: vi.fn().mockResolvedValue({ id: "c1" }),
      update: vi.fn().mockResolvedValue({ id: "c1" }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    chatMember: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: "m1" }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  } as unknown as PrismaClient;
}

describe("createChatsRepository", () => {
  it("AC-42: create delegates to prisma.chat.create", async () => {
    const prisma = mockPrisma();
    const repo = createChatsRepository(prisma);
    await repo.create({ ownerId: "u1", ownerEmail: "u1@example.com", title: "t", provider: "ollama", model: "m" });
    expect(prisma.chat.create).toHaveBeenCalledWith({
      data: { ownerId: "u1", ownerEmail: "u1@example.com", title: "t", provider: "ollama", model: "m" },
    });
  });

  it("AC-47: findManyAccessible returns only chats the user owns or is a member of", async () => {
    const prisma = mockPrisma();
    const repo = createChatsRepository(prisma);
    await repo.findManyAccessible("u1", "u1@example.com");
    expect(prisma.chat.findMany).toHaveBeenCalledWith({
      where: { OR: [{ ownerId: "u1" }, { members: { some: { email: "u1@example.com" } } }] },
      orderBy: { updatedAt: "desc" },
    });
  });

  it("AC-45: findAccessible scopes the query by id and ownership-or-membership", async () => {
    const prisma = mockPrisma();
    const repo = createChatsRepository(prisma);
    await repo.findAccessible("c1", "u1", "u1@example.com");
    expect(prisma.chat.findFirst).toHaveBeenCalledWith({
      where: { id: "c1", OR: [{ ownerId: "u1" }, { members: { some: { email: "u1@example.com" } } }] },
    });
  });

  it("removeMember reports whether a member was actually removed", async () => {
    const prisma = mockPrisma();
    const repo = createChatsRepository(prisma);
    await expect(repo.removeMember("c1", "b@example.com")).resolves.toBe(true);
    expect(prisma.chatMember.deleteMany).toHaveBeenCalledWith({ where: { chatId: "c1", email: "b@example.com" } });

    vi.mocked(prisma.chatMember.deleteMany).mockResolvedValueOnce({ count: 0 });
    await expect(repo.removeMember("c1", "nobody@example.com")).resolves.toBe(false);
  });

  it("AC-45: findByIdAndOwner scopes the query by id and ownerId", async () => {
    const prisma = mockPrisma();
    const repo = createChatsRepository(prisma);
    await repo.findByIdAndOwner("c1", "u1");
    expect(prisma.chat.findFirst).toHaveBeenCalledWith({ where: { id: "c1", ownerId: "u1" } });
  });

  it("AC-45: findById performs an unscoped lookup for trusted internal callers", async () => {
    const prisma = mockPrisma();
    const repo = createChatsRepository(prisma);
    await repo.findById("c1");
    expect(prisma.chat.findUnique).toHaveBeenCalledWith({ where: { id: "c1" } });
  });

  it("AC-48: update delegates to prisma.chat.update", async () => {
    const prisma = mockPrisma();
    const repo = createChatsRepository(prisma);
    await repo.update("c1", { title: "new" });
    expect(prisma.chat.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { title: "new" } });
  });

  it("AC-44: delete delegates to prisma.chat.delete", async () => {
    const prisma = mockPrisma();
    const repo = createChatsRepository(prisma);
    await repo.delete("c1");
    expect(prisma.chat.delete).toHaveBeenCalledWith({ where: { id: "c1" } });
  });
});
