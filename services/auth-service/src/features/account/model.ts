/**
 * Account deletion (GDPR Art. 17, AICHAT-79). conversation-service has no way to learn that a user
 * is gone, so the order matters: first it erases the chats, messages and files of the user, and only
 * when that succeeded the `User` row is deleted (refresh tokens cascade). Every step is safe to
 * repeat, so after any failure the same request can simply be sent again.
 */
import type { PrismaClient } from "../../generated/prisma-client/index.js";
import type { ErasureClient } from "../../shared/erasure-client.js";

export interface AccountToErase {
  id: string;
  email: string;
}

export async function deleteAccount(prisma: PrismaClient, erasure: ErasureClient, account: AccountToErase): Promise<void> {
  await erasure.eraseUser(account.id, account.email);
  // deleteMany, not delete: a repeated request finds no row and that is a success.
  await prisma.user.deleteMany({ where: { id: account.id } });
}
