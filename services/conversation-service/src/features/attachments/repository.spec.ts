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
});
