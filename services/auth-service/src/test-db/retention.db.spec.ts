/** Retention job of auth-service against a real Postgres, with the clock under the test's control (AICHAT-137). */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "../generated/prisma-client/index.js";
import { inactiveAccountCutoff, refreshTokenCutoff, runRetention } from "../features/retention/index.js";

const prisma = new PrismaClient();
const NOW = new Date("2026-10-04T12:00:00.000Z");
const SECOND = 1000;
const at = (base: Date, offsetMs: number) => new Date(base.getTime() + offsetMs);

const erasure = { eraseUser: vi.fn().mockResolvedValue(undefined) };

beforeEach(async () => {
  erasure.eraseUser.mockClear().mockResolvedValue(undefined);
  await prisma.user.deleteMany(); // refresh tokens cascade
});

afterAll(() => prisma.$disconnect());

async function userWithToken(email: string, lastActiveAt: Date, expiresAt: Date) {
  const user = await prisma.user.create({ data: { email, passwordHash: "x", lastActiveAt } });
  const token = await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: `hash-${email}`, expiresAt } });
  return { user, token };
}

describe("refresh tokens: deleted 7 days after they expire", () => {
  const limit = refreshTokenCutoff(NOW);

  it.each([
    ["1 second before the limit (expired 6 d 23 h 59 min 59 s ago)", at(limit, +SECOND), true],
    ["exactly at the limit (expired 7 d ago)", limit, true],
    ["1 second after the limit (expired 7 d 1 s ago)", at(limit, -SECOND), false],
    ["not yet expired", at(NOW, 60 * 60 * SECOND), true],
  ])("%s -> kept: %s", async (_label, expiresAt, kept) => {
    const { token } = await userWithToken("t@example.test", NOW, expiresAt);

    await runRetention(NOW, { prisma, erasure });

    expect((await prisma.refreshToken.findUnique({ where: { id: token.id } })) !== null).toBe(kept);
  });

  it("follows the clock: the same token survives an earlier run and goes in a later one", async () => {
    const { token } = await userWithToken("t@example.test", NOW, at(limit, -SECOND));

    await runRetention(at(NOW, -60 * SECOND), { prisma, erasure });
    expect(await prisma.refreshToken.findUnique({ where: { id: token.id } })).not.toBeNull();

    await runRetention(NOW, { prisma, erasure });
    expect(await prisma.refreshToken.findUnique({ where: { id: token.id } })).toBeNull();
  });

  it("deletes expired and revoked tokens alike, and only the old ones", async () => {
    const { user } = await userWithToken("t@example.test", NOW, at(limit, -SECOND));
    await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: "revoked-old", expiresAt: at(limit, -SECOND), revokedAt: at(limit, -2 * SECOND) } });
    await prisma.refreshToken.create({ data: { userId: user.id, tokenHash: "revoked-recent", expiresAt: at(NOW, SECOND), revokedAt: NOW } });

    const result = await runRetention(NOW, { prisma, erasure });

    expect(result.refreshTokensDeleted).toBe(2);
    expect((await prisma.refreshToken.findMany({ where: { userId: user.id } })).map((t) => t.tokenHash)).toEqual(["revoked-recent"]);
  });
});

describe("accounts: deleted after 24 months without activity", () => {
  const limit = inactiveAccountCutoff(NOW);

  it.each([
    ["1 second before the limit (idle 24 months less 1 s)", at(limit, +SECOND), true],
    ["exactly at the limit (idle 24 months)", limit, true],
    ["1 second after the limit (idle 24 months and 1 s)", at(limit, -SECOND), false],
    ["active today", NOW, true],
  ])("%s -> kept: %s", async (_label, lastActiveAt, kept) => {
    const { user } = await userWithToken("a@example.test", lastActiveAt, at(NOW, 60 * 60 * SECOND));

    await runRetention(NOW, { prisma, erasure });

    expect((await prisma.user.findUnique({ where: { id: user.id } })) !== null).toBe(kept);
    expect(erasure.eraseUser).toHaveBeenCalledTimes(kept ? 0 : 1);
  });

  it("erases the chats first, deletes the user and the refresh tokens cascade", async () => {
    const { user } = await userWithToken("old@example.test", at(limit, -SECOND), at(NOW, 60 * 60 * SECOND));

    const result = await runRetention(NOW, { prisma, erasure });

    expect(erasure.eraseUser).toHaveBeenCalledWith(user.id, "old@example.test");
    expect(result.accountsDeleted).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(await prisma.refreshToken.count({ where: { userId: user.id } })).toBe(0);
  });

  it("keeps the account when the erasure fails and deletes it on the next run", async () => {
    const { user } = await userWithToken("old@example.test", at(limit, -SECOND), at(NOW, 60 * 60 * SECOND));
    erasure.eraseUser.mockRejectedValueOnce(new Error("conversation-service is down"));

    const failed = await runRetention(NOW, { prisma, erasure });
    expect(failed).toMatchObject({ accountsDeleted: 0, accountsFailed: 1 });
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();

    const retried = await runRetention(at(NOW, 6 * 60 * 60 * SECOND), { prisma, erasure });
    expect(retried.accountsDeleted).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });

  it("leaves due accounts alone without an erasure client", async () => {
    const { user } = await userWithToken("old@example.test", at(limit, -SECOND), at(NOW, 60 * 60 * SECOND));

    const result = await runRetention(NOW, { prisma });

    expect(result.accountsSkipped).toBe(1);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });
});

describe("idempotency", () => {
  it("a second run right after the first deletes nothing more and keeps what was kept", async () => {
    const old = await userWithToken("old@example.test", at(inactiveAccountCutoff(NOW), -SECOND), at(refreshTokenCutoff(NOW), -SECOND));
    const fresh = await userWithToken("fresh@example.test", NOW, at(NOW, 60 * 60 * SECOND));

    const first = await runRetention(NOW, { prisma, erasure });
    const second = await runRetention(NOW, { prisma, erasure });

    expect(first).toMatchObject({ accountsDeleted: 1 });
    expect(first.refreshTokensDeleted).toBeGreaterThanOrEqual(0);
    expect(second).toEqual({ refreshTokensDeleted: 0, accountsDeleted: 0, accountsFailed: 0, accountsSkipped: 0 });
    expect(await prisma.user.findUnique({ where: { id: old.user.id } })).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: fresh.user.id } })).not.toBeNull();
    expect(await prisma.refreshToken.findUnique({ where: { id: fresh.token.id } })).not.toBeNull();
  });
});
