/**
 * Login/session business logic (PLAN.md B3): credential verification, access/refresh
 * token issuance, refresh-token rotation, and revocation.
 *
 * Refresh token contract (ARCHITECTURE.md §4 / STACK.md decisions #1, #2): an opaque
 * random value is returned to the client (in the `refresh_token` cookie); only a SHA-256
 * hash of it is ever persisted, so a leaked database never exposes usable tokens. Refresh
 * tokens are single-use and rotate on every use — the old row is marked `revokedAt` and
 * a new row (`rotatedFrom` pointing at the old id) is created, so a replayed/reused old
 * token is rejected even though it was once valid.
 */
import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcrypt";
import type { PrismaClient } from "../../generated/prisma-client/index.js";
import { auth } from "../../shared/contracts/index.js";
import { env } from "../../shared/env.js";
import { HttpError } from "../../shared/error-middleware.js";
import { signAccessToken } from "../../shared/jwt.js";

const REFRESH_TOKEN_BYTES = 64;

export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
}

function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Verifies email/password. On any failure (unknown email, wrong password) throws the
 * exact same `HttpError` (status + code + message) so the caller can't distinguish which
 * field was wrong (AC-36).
 */
export async function verifyCredentials(
  prisma: PrismaClient,
  input: auth.LoginRequest,
): Promise<AuthenticatedUser> {
  const invalidCredentials = () =>
    new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password");

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    // Still hash a dummy value so unknown-email and wrong-password requests take a
    // comparable amount of time (defense against email-enumeration by timing).
    // Dummy hash for constant-time compare, not a credential (WAIVERS.md W3)
    // nosemgrep: detected-bcrypt-hash
    await bcrypt.compare(input.password, "$2b$12$CwTycUXWue0Thq9StjUM0uJ8i6C6/EF9j5sMz6E7L2X4Y0h4h4h4u");
    throw invalidCredentials();
  }

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) {
    throw invalidCredentials();
  }

  return { id: user.id, email: user.email };
}

/** Signs a new access token and creates + persists (hashed) a new refresh token. */
export async function issueTokens(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  options?: { rotatedFrom?: string },
): Promise<IssuedTokens> {
  const accessToken = signAccessToken({ sub: user.id, email: user.email }, env.JWT_SECRET);

  const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
  const tokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + auth.REFRESH_TOKEN_TTL_SECONDS * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
      rotatedFrom: options?.rotatedFrom,
    },
  });
  // Every sign-in and every refresh counts as activity; the retention job deletes accounts idle for 24 months.
  await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() } });

  return { accessToken, refreshToken };
}

/**
 * Validates a presented refresh token against its stored hash, rejecting it if unknown,
 * expired, or already revoked (covers both explicit revocation via logout and the
 * rotate-on-use invalidation of a reused/rotated-out token).
 */
export async function rotateRefreshToken(
  prisma: PrismaClient,
  presentedToken: string,
): Promise<{ tokens: IssuedTokens; user: AuthenticatedUser }> {
  const invalidToken = () =>
    new HttpError(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");

  const tokenHash = hashRefreshToken(presentedToken);
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!row || row.revokedAt || row.expiresAt.getTime() < Date.now()) {
    throw invalidToken();
  }

  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });

  const user: AuthenticatedUser = { id: row.user.id, email: row.user.email };
  const tokens = await issueTokens(prisma, user, { rotatedFrom: row.id });

  return { tokens, user };
}

/** Revokes the refresh token row matching the presented token, if any (logout). */
/** Revokes the presented refresh token. Returns the id of the user whose session this call
 * ended, or `null` when the token is unknown or was already revoked (so replaying an old token
 * does not act on the user again, see AICHAT-203). */
export async function revokeRefreshToken(prisma: PrismaClient, presentedToken: string): Promise<string | null> {
  const tokenHash = hashRefreshToken(presentedToken);
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!row || row.revokedAt) {
    return null;
  }
  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });
  return row.userId;
}

export async function getUserById(
  prisma: PrismaClient,
  id: string,
): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? { id: user.id, email: user.email } : null;
}
