import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../shared/prisma.js";
import { Prisma } from "../../generated/prisma-client/index.js";
import { createMessagesRepository } from "./service.js";

function mockPrisma() {
  return {
    message: {
      create: vi.fn().mockResolvedValue({ id: "m1" }),
      findMany: vi.fn().mockResolvedValue([{ id: "m1" }]),
      findFirst: vi.fn().mockResolvedValue({ id: "m1" }),
      findUnique: vi.fn().mockResolvedValue({ id: "m1" }),
      update: vi.fn().mockResolvedValue({ id: "m1" }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as PrismaClient;
}

describe("createMessagesRepository", () => {
  it("AC-51: create includes attachments and delegates to prisma.message.create", async () => {
    const prisma = mockPrisma();
    const repo = createMessagesRepository(prisma);
    await repo.create({ chatId: "c1", ownerId: "u1", role: "user", content: "hi", status: "sent" });
    expect(prisma.message.create).toHaveBeenCalledWith({
      data: { chatId: "c1", ownerId: "u1", role: "user", content: "hi", status: "sent" },
      include: { attachments: true },
    });
  });

  it("AC-53: findByChatOrdered orders messages oldest first, ties broken by id", async () => {
    const prisma = mockPrisma();
    const repo = createMessagesRepository(prisma);
    await repo.findByChatOrdered("c1");
    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: { chatId: "c1" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      include: { attachments: true },
    });
  });

  it("AICHAT-191: a message written before a reply started but queued behind it is listed after that reply", async () => {
    const at = (ms: number) => new Date(ms);
    const row = (id: string, createdAt: number, sentAt: number | null) => ({ id, createdAt: at(createdAt), sentAt: sentAt === null ? null : at(sentAt) });
    const prisma = mockPrisma();
    // As the database returns them (by createdAt): q1 was written at 2, before r0 existed.
    vi.mocked(prisma.message.findMany).mockResolvedValue([
      row("q0", 1, 10),
      row("q1", 2, 30), // its turn started at 30, after r0
      row("q2", 3, null), // still queued
      row("r0", 11, 11),
      row("r1", 31, 31),
    ] as never);
    const repo = createMessagesRepository(prisma);

    expect((await repo.findByChatOrdered("c1")).map((m) => m.id)).toEqual(["q2", "q0", "r0", "q1", "r1"]);
  });

  it("AICHAT-191: rows from before sentAt keep their creation order", async () => {
    const prisma = mockPrisma();
    vi.mocked(prisma.message.findMany).mockResolvedValue([
      { id: "old-q", createdAt: new Date(1), sentAt: null },
      { id: "old-r", createdAt: new Date(2), sentAt: null },
      { id: "new-q", createdAt: new Date(50), sentAt: new Date(60) },
    ] as never);
    const repo = createMessagesRepository(prisma);

    expect((await repo.findByChatOrdered("c1")).map((m) => m.id)).toEqual(["old-q", "old-r", "new-q"]);
  });

  it("AC-45: findByIdAndOwner scopes by id and ownerId", async () => {
    const prisma = mockPrisma();
    const repo = createMessagesRepository(prisma);
    await repo.findByIdAndOwner("m1", "u1");
    expect(prisma.message.findFirst).toHaveBeenCalledWith({ where: { id: "m1", ownerId: "u1" }, include: { attachments: true } });
  });

  it("findById performs an unscoped lookup for the queue processor", async () => {
    const prisma = mockPrisma();
    const repo = createMessagesRepository(prisma);
    await repo.findById("m1");
    expect(prisma.message.findUnique).toHaveBeenCalledWith({ where: { id: "m1" }, include: { attachments: true } });
  });

  it("AC-56: updateStatus delegates to prisma.message.update", async () => {
    const prisma = mockPrisma();
    const repo = createMessagesRepository(prisma);
    await repo.updateStatus("m1", "queued");
    expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { status: "queued" }, include: { attachments: true } });
  });

  it("AICHAT-191: updateStatus stamps sentAt when a turn starts", async () => {
    const prisma = mockPrisma();
    const repo = createMessagesRepository(prisma);
    const sentAt = new Date(42);
    await repo.updateStatus("m1", "sent", sentAt);
    expect(prisma.message.update).toHaveBeenCalledWith({ where: { id: "m1" }, data: { status: "sent", sentAt }, include: { attachments: true } });
  });

  it("AC-55: updateContent delegates to prisma.message.update", async () => {
    const prisma = mockPrisma();
    const repo = createMessagesRepository(prisma);
    await repo.updateContent("m1", { content: "done", status: "sent" });
    expect(prisma.message.update).toHaveBeenCalledWith({
      where: { id: "m1" },
      data: { content: "done", status: "sent" },
      include: { attachments: true },
    });
  });

  it("updateContent stores web fetches as JSON and clears them with DbNull", async () => {
    const prisma = mockPrisma();
    const repo = createMessagesRepository(prisma);
    const fetches = [{ id: "f1", url: "https://example.com", status: "done" as const }];
    await repo.updateContent("m1", { content: "a", webFetches: fetches, status: "sent" });
    expect(prisma.message.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { content: "a", webFetches: fetches, status: "sent" } }));
    await repo.updateContent("m1", { content: "b", webFetches: null, status: "sent" });
    expect(prisma.message.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { content: "b", webFetches: Prisma.DbNull, status: "sent" } }));
  });

  it("AC-58: delete delegates to prisma.message.delete", async () => {
    const prisma = mockPrisma();
    const repo = createMessagesRepository(prisma);
    await repo.delete("m1");
    expect(prisma.message.delete).toHaveBeenCalledWith({ where: { id: "m1" } });
  });
});
