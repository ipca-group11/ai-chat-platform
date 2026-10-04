import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma-client/index.js";
import { deleteAccount } from "./model.js";

describe("deleteAccount", () => {
  it("does not touch the user row when the erasure fails", async () => {
    const deleteMany = vi.fn();
    const prisma = { user: { deleteMany } } as unknown as PrismaClient;
    const erasure = { eraseUser: vi.fn(() => Promise.reject(new Error("down"))) };

    await expect(deleteAccount(prisma, erasure, { id: "u1", email: "u1@example.com" })).rejects.toThrow("down");

    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("erases first and then deletes the user by id", async () => {
    const order: string[] = [];
    const prisma = { user: { deleteMany: vi.fn(async () => void order.push("row")) } } as unknown as PrismaClient;
    const erasure = { eraseUser: vi.fn(async () => void order.push("erase")) };

    await deleteAccount(prisma, erasure, { id: "u1", email: "u1@example.com" });

    expect(order).toEqual(["erase", "row"]);
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({ where: { id: "u1" } });
  });
});
