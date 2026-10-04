/**
 * Retention job of auth-service (GDPR Art. 5(1)(e), AICHAT-137; the periods are in docs/AICHAT-33/RETENTION.md):
 * - refresh tokens are deleted 7 days after they expire;
 * - accounts with no sign-in or token refresh for 24 months are deleted, with their chats (the same
 *   erasure as `DELETE /auth/me`).
 *
 * `runRetention` takes the time as a parameter and has no timers of its own, so tests drive it with any
 * clock. It is safe to repeat: a second run right after the first finds nothing to delete.
 */
import type { PrismaClient } from "../../generated/prisma-client/index.js";
import type { ErasureClient } from "../../shared/erasure-client.js";
import { deleteAccount } from "../account/index.js";

export const REFRESH_TOKEN_GRACE_DAYS = 7;
export const INACTIVE_ACCOUNT_MONTHS = 24;
/** Accounts handled per run, so one run stays short; the next run takes the rest. */
const ACCOUNTS_PER_RUN = 200;

export interface RetentionDeps {
  prisma: PrismaClient;
  /** Needed to delete inactive accounts; without it they are left alone (never delete half an account). */
  erasure?: ErasureClient;
  onAccountError?: (userId: string, error: unknown) => void;
}

export interface RetentionResult {
  refreshTokensDeleted: number;
  accountsDeleted: number;
  /** Accounts that could not be deleted this time (conversation-service failed); the next run retries them. */
  accountsFailed: number;
  /** Accounts that are due but skipped because no erasure client is configured. */
  accountsSkipped: number;
}

/** Tokens that expired before this moment are deleted. */
export function refreshTokenCutoff(now: Date): Date {
  return new Date(now.getTime() - REFRESH_TOKEN_GRACE_DAYS * 24 * 60 * 60 * 1000);
}

/** Accounts last active before this moment are deleted (24 calendar months back, UTC). */
export function inactiveAccountCutoff(now: Date): Date {
  const cutoff = new Date(now);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - INACTIVE_ACCOUNT_MONTHS);
  return cutoff;
}

export async function runRetention(now: Date, { prisma, erasure, onAccountError }: RetentionDeps): Promise<RetentionResult> {
  const tokens = await prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: refreshTokenCutoff(now) } } });

  const due = await prisma.user.findMany({
    where: { lastActiveAt: { lt: inactiveAccountCutoff(now) } },
    select: { id: true, email: true },
    orderBy: { lastActiveAt: "asc" },
    take: ACCOUNTS_PER_RUN,
  });

  const result: RetentionResult = { refreshTokensDeleted: tokens.count, accountsDeleted: 0, accountsFailed: 0, accountsSkipped: 0 };
  if (!erasure) {
    result.accountsSkipped = due.length;
    return result;
  }
  for (const account of due) {
    try {
      await deleteAccount(prisma, erasure, account);
      result.accountsDeleted += 1;
    } catch (error) {
      result.accountsFailed += 1;
      onAccountError?.(account.id, error);
    }
  }
  return result;
}
