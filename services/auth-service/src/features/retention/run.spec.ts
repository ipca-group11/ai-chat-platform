import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../../generated/prisma-client/index.js";
import { inactiveAccountCutoff, refreshTokenCutoff, runRetention } from "./run.js";

const NOW = new Date("2026-10-04T12:00:00.000Z");

describe("retention cutoffs", () => {
  it("refresh tokens: 7 days before now", () => {
    expect(refreshTokenCutoff(NOW).toISOString()).toBe("2026-09-27T12:00:00.000Z");
  });

  it("inactive accounts: 24 calendar months before now", () => {
    expect(inactiveAccountCutoff(NOW).toISOString()).toBe("2024-10-04T12:00:00.000Z");
  });

  it("inactive accounts: a leap day moves to the next valid day instead of failing", () => {
    expect(inactiveAccountCutoff(new Date("2028-02-29T00:00:00.000Z")).toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("does not change the date it is given", () => {
    const now = new Date(NOW);
    inactiveAccountCutoff(now);
    expect(now.toISOString()).toBe(NOW.toISOString());
  });
});

function mockPrisma(due: Array<{ id: string; email: string }> = []) {
  return {
    refreshToken: { deleteMany: vi.fn().mockResolvedValue({ count: 3 }) },
    user: { findMany: vi.fn().mockResolvedValue(due), deleteMany: vi.fn().mockResolvedValue({ count: 1 }) },
  } as unknown as PrismaClient & { refreshToken: { deleteMany: ReturnType<typeof vi.fn> }; user: { findMany: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> } };
}

describe("runRetention", () => {
  it("deletes tokens expired before the cutoff and looks for accounts idle since before the cutoff", async () => {
    const prisma = mockPrisma();

    const result = await runRetention(NOW, { prisma });

    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: refreshTokenCutoff(NOW) } } });
    expect(prisma.user.findMany.mock.calls[0]?.[0].where).toEqual({ lastActiveAt: { lt: inactiveAccountCutoff(NOW) } });
    expect(result).toEqual({ refreshTokensDeleted: 3, accountsDeleted: 0, accountsFailed: 0, accountsSkipped: 0 });
  });

  it("erases the conversation data of a due account before deleting it", async () => {
    const prisma = mockPrisma([{ id: "u1", email: "u1@example.com" }]);
    const erasure = { eraseUser: vi.fn().mockResolvedValue(undefined) };

    const result = await runRetention(NOW, { prisma, erasure });

    expect(erasure.eraseUser).toHaveBeenCalledWith("u1", "u1@example.com");
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({ where: { id: "u1" } });
    expect(result.accountsDeleted).toBe(1);
  });

  it("keeps an account whose erasure failed, reports it and carries on with the others", async () => {
    const prisma = mockPrisma([{ id: "u1", email: "u1@example.com" }, { id: "u2", email: "u2@example.com" }]);
    const erasure = { eraseUser: vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValue(undefined) };
    const onAccountError = vi.fn();

    const result = await runRetention(NOW, { prisma, erasure, onAccountError });

    expect(result).toMatchObject({ accountsDeleted: 1, accountsFailed: 1 });
    expect(prisma.user.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.user.deleteMany).toHaveBeenCalledWith({ where: { id: "u2" } });
    expect(onAccountError).toHaveBeenCalledWith("u1", expect.any(Error));
  });

  it("leaves due accounts alone when no erasure client is configured", async () => {
    const prisma = mockPrisma([{ id: "u1", email: "u1@example.com" }]);

    const result = await runRetention(NOW, { prisma });

    expect(result.accountsSkipped).toBe(1);
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();
  });
});
