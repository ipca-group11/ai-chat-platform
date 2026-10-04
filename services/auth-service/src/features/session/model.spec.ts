import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { env } from "../../shared/env.js";
import { HttpError } from "../../shared/error-middleware.js";
import { verifyAccessToken } from "../../shared/jwt.js";
import {
  getUserById,
  issueTokens,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyCredentials,
} from "./model.js";
import { fakePrisma, makeUser } from "../../test-utils/fake-prisma.js";

function hashForTest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function issueTokensDirect(
  prisma: ReturnType<typeof fakePrisma>,
  user: { id: string; email: string },
) {
  return { tokens: await issueTokens(prisma, user) };
}

describe("verifyCredentials", () => {
  it("AC-35: valid credentials resolve with the user's id/email", async () => {
    const user = await makeUser("valid@example.com", "password1");
    const prisma = fakePrisma({ users: [user] });

    const result = await verifyCredentials(prisma, {
      email: "valid@example.com",
      password: "password1",
    });

    expect(result).toEqual({ id: user.id, email: user.email });
  });

  it("AC-36: an unknown email is rejected with the generic invalid-credentials error", async () => {
    const prisma = fakePrisma();

    await expect(
      verifyCredentials(prisma, { email: "nobody@example.com", password: "password1" }),
    ).rejects.toMatchObject({ status: 401, code: "INVALID_CREDENTIALS", message: "Invalid email or password" });
  });

  it("AC-36: a wrong password is rejected with the exact same status/code/message as an unknown email", async () => {
    const user = await makeUser("known@example.com", "correct-password1");
    const prisma = fakePrisma({ users: [user] });

    let unknownEmailError: HttpError | undefined;
    let wrongPasswordError: HttpError | undefined;

    try {
      await verifyCredentials(prisma, { email: "nobody@example.com", password: "x" });
    } catch (err) {
      unknownEmailError = err as HttpError;
    }
    try {
      await verifyCredentials(prisma, { email: "known@example.com", password: "wrong-password1" });
    } catch (err) {
      wrongPasswordError = err as HttpError;
    }

    expect(unknownEmailError).toBeInstanceOf(HttpError);
    expect(wrongPasswordError).toBeInstanceOf(HttpError);
    expect(wrongPasswordError?.status).toBe(unknownEmailError?.status);
    expect(wrongPasswordError?.code).toBe(unknownEmailError?.code);
    expect(wrongPasswordError?.message).toBe(unknownEmailError?.message);
  });
});

describe("issueTokens", () => {
  it("AC-37: issues an access token verifiable with JWT_SECRET and a random opaque refresh token", async () => {
    const stored = await makeUser("a@b.com", "password1");
    const prisma = fakePrisma({ users: [stored] });
    const user = { id: stored.id, email: stored.email };

    const tokens = await issueTokens(prisma, user);

    const claims = verifyAccessToken(tokens.accessToken, env.JWT_SECRET);
    expect(claims.sub).toBe(user.id);
    expect(claims.email).toBe(user.email);
    expect(tokens.refreshToken).toMatch(/^[0-9a-f]+$/);
    expect(prisma.refreshToken.create).toHaveBeenCalledOnce();
  });

  it("AICHAT-137: records the sign-in as activity, so the account is not deleted as inactive", async () => {
    const stored = { ...(await makeUser("a@b.com", "password1")), lastActiveAt: new Date("2020-01-01T00:00:00Z") };
    const prisma = fakePrisma({ users: [stored] });

    await issueTokens(prisma, { id: stored.id, email: stored.email });

    expect((await prisma.user.findUnique({ where: { id: stored.id } }))?.lastActiveAt.getFullYear()).toBeGreaterThan(2025);
  });

  it("never persists the refresh token in plaintext (only its hash)", async () => {
    const stored = await makeUser("a@b.com", "password1");
    const prisma = fakePrisma({ users: [stored] });
    const user = { id: stored.id, email: stored.email };

    const tokens = await issueTokens(prisma, user);

    const createCall = (prisma.refreshToken.create as unknown as { mock: { calls: unknown[][] } })
      .mock.calls[0]?.[0] as { data: { tokenHash: string } };
    expect(createCall.data.tokenHash).not.toBe(tokens.refreshToken);
  });
});

describe("rotateRefreshToken", () => {
  it("AC-37: rotates a valid refresh token: old row is revoked, a new token is issued", async () => {
    const user = await makeUser("rotate@example.com", "password1");
    const prisma = fakePrisma({ users: [user] });
    const { tokens: initial } = await issueTokensDirect(prisma, user);

    const { tokens: rotated, user: returnedUser } = await rotateRefreshToken(prisma, initial.refreshToken);

    expect(returnedUser).toEqual({ id: user.id, email: user.email });
    expect(rotated.refreshToken).not.toBe(initial.refreshToken);
  });

  it("AC-37: a reused/rotated-out refresh token is rejected on the next use", async () => {
    const user = await makeUser("reuse@example.com", "password1");
    const prisma = fakePrisma({ users: [user] });
    const { tokens: initial } = await issueTokensDirect(prisma, user);

    await rotateRefreshToken(prisma, initial.refreshToken);

    await expect(rotateRefreshToken(prisma, initial.refreshToken)).rejects.toMatchObject({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  it("rejects an unknown refresh token", async () => {
    const prisma = fakePrisma();

    await expect(rotateRefreshToken(prisma, "does-not-exist")).rejects.toMatchObject({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  it("rejects an expired refresh token", async () => {
    const user = await makeUser("expired@example.com", "password1");
    const prisma = fakePrisma({ users: [user] });
    const { tokens: initial } = await issueTokensDirect(prisma, user);
    // Manually expire the stored row.
    const row = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashForTest(initial.refreshToken) },
    });
    await prisma.refreshToken.update({
      where: { id: (row as { id: string }).id },
      data: { expiresAt: new Date(0) },
    });

    await expect(rotateRefreshToken(prisma, initial.refreshToken)).rejects.toMatchObject({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
  });
});

describe("revokeRefreshToken (logout)", () => {
  it("AC-38: revokes the refresh token so a subsequent refresh is rejected", async () => {
    const user = await makeUser("logout@example.com", "password1");
    const prisma = fakePrisma({ users: [user] });
    const { tokens: initial } = await issueTokensDirect(prisma, user);

    await revokeRefreshToken(prisma, initial.refreshToken);

    await expect(rotateRefreshToken(prisma, initial.refreshToken)).rejects.toMatchObject({
      status: 401,
      code: "INVALID_REFRESH_TOKEN",
    });
  });

  it("is a no-op for an unknown token (no throw)", async () => {
    const prisma = fakePrisma();
    await expect(revokeRefreshToken(prisma, "unknown")).resolves.toBeUndefined();
  });
});

describe("getUserById", () => {
  it("AC-35: returns the user's public profile for a known id", async () => {
    const user = await makeUser("me@example.com", "password1");
    const prisma = fakePrisma({ users: [user] });

    const result = await getUserById(prisma, user.id);

    expect(result).toEqual({ id: user.id, email: user.email });
  });

  it("returns null for an unknown id", async () => {
    const prisma = fakePrisma();
    const result = await getUserById(prisma, "does-not-exist");
    expect(result).toBeNull();
  });
});
