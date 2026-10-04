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
import type { PrismaClient } from "../../generated/prisma-client/index.js";
import { auth } from "../../shared/contracts/index.js";
import { env } from "../../shared/env.js";
import { HttpError } from "../../shared/error-middleware.js";
import { signAccessToken } from "../../shared/jwt.js";
import { burnPasswordCheck, verifyPassword } from "../../shared/password.js";

const REFRESH_TOKEN_BYTES = 64;

export interface AuthenticatedUser {
  id: string;
  email: string;
  /** Whether the user proved they control `email` (AICHAT-253). */
  emailVerified: boolean;
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
    // Still run a bcrypt compare so unknown-email and wrong-password requests take a
    // comparable amount of time (defense against email-enumeration by timing).
    await burnPasswordCheck(input.password);
    throw invalidCredentials();
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    throw invalidCredentials();
  }

  return { id: user.id, email: user.email, emailVerified: user.emailVerified };
}

/** Signs a new access token and creates + persists (hashed) a new refresh token. */
export async function issueTokens(
  prisma: PrismaClient,
  user: AuthenticatedUser,
  options?: { rotatedFrom?: string },
): Promise<IssuedTokens> {
  const accessToken = signAccessToken({ sub: user.id, email: user.email, emailVerified: user.emailVerified }, env.JWT_SECRET);

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

  const user: AuthenticatedUser = { id: row.user.id, email: row.user.email, emailVerified: row.user.emailVerified };
  const tokens = await issueTokens(prisma, user, { rotatedFrom: row.id });

  return { tokens, user };
}

/** Revokes the refresh token row matching the presented token, if any (logout). */
export async function revokeRefreshToken(prisma: PrismaClient, presentedToken: string): Promise<void> {
  const tokenHash = hashRefreshToken(presentedToken);
  const row = await prisma.refreshToken.findUnique({ where: { tokenHash } });
  if (!row || row.revokedAt) {
    return;
  }
  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });
}

export async function getUserById(
  prisma: PrismaClient,
  id: string,
): Promise<AuthenticatedUser | null> {
  const user = await prisma.user.findUnique({ where: { id } });
  return user ? { id: user.id, email: user.email, emailVerified: user.emailVerified } : null;
}
