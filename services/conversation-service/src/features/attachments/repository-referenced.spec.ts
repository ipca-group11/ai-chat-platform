import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../shared/prisma.js";
import { createAttachmentsRepository } from "./service.js";

describe("createAttachmentsRepository.findReferencedPaths", () => {
  it("returns the storage paths that have an attachment row", async () => {
    const findMany = vi.fn().mockResolvedValue([{ storagePath: "/u/a.txt" }]);
    const repo = createAttachmentsRepository({ attachment: { findMany } } as unknown as PrismaClient);

    expect(await repo.findReferencedPaths(["/u/a.txt", "/u/b.txt"])).toEqual(new Set(["/u/a.txt"]));
    expect(findMany).toHaveBeenCalledWith({ where: { storagePath: { in: ["/u/a.txt", "/u/b.txt"] } }, select: { storagePath: true } });
  });

  it("does not query for an empty list", async () => {
    const findMany = vi.fn();
    const repo = createAttachmentsRepository({ attachment: { findMany } } as unknown as PrismaClient);

    expect(await repo.findReferencedPaths([])).toEqual(new Set());
    expect(findMany).not.toHaveBeenCalled();
  });
});
