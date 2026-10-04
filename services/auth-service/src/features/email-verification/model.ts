/**
 * Email ownership (AICHAT-253, pentest H1). Registration alone proves nothing about the address, so
 * a new account starts unverified and gets a single-use token through the mailer. Presenting the
 * token marks the account verified; access tokens then carry `email_verified: true`, which
 * conversation-service requires before it opens a chat shared with that address.
 *
 * Tokens are 32 random bytes (64 hex characters); only their SHA-256 hash is stored, like refresh
 * tokens. A token expires after 24 hours, and issuing a new one invalidates the older ones.
 */
import { createHash, randomBytes } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma-client/index.js";
import { auth } from "../../shared/contracts/index.js";
import { HttpError } from "../../shared/error-middleware.js";
import type { Mailer } from "../../shared/mailer.js";

const TOKEN_BYTES = 32;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface UserToVerify {
  id: string;
  email: string;
}

/** Replaces any pending token of the user with a new one and hands it to the mailer. */
export async function sendVerificationEmail(prisma: PrismaClient, mailer: Mailer, user: UserToVerify): Promise<void> {
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + auth.EMAIL_VERIFICATION_TTL_SECONDS * 1000);
  await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id } });
  await prisma.emailVerificationToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt } });
  await mailer.sendEmailVerification({ userId: user.id, email: user.email, token, expiresAt });
}

/** Marks the token's user verified and spends every token of that user. Unknown or expired -> 400. */
export async function verifyEmail(prisma: PrismaClient, token: string): Promise<{ userId: string }> {
  const row = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.expiresAt.getTime() < Date.now()) {
    throw new HttpError(400, "INVALID_VERIFICATION_TOKEN", "Invalid or expired verification token");
  }
  await prisma.user.update({ where: { id: row.userId }, data: { emailVerified: true, emailVerifiedAt: new Date() } });
  await prisma.emailVerificationToken.deleteMany({ where: { userId: row.userId } });
  return { userId: row.userId };
}
