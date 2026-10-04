import type { PrismaClient } from "../../shared/prisma.js";

export interface ErasureResult {
  /** Chats the user owned (with their members, messages and attachments). */
  chats: number;
  /** The user's membership rows in chats owned by other users. */
  memberships: number;
  /** Messages the user wrote in chats owned by other users. */
  messages: number;
  /** Files of every attachment row that was deleted; the caller removes them after the commit. */
  storagePaths: string[];
}

export interface ErasureRepository {
  /** Deletes everything the user has in this service, in one transaction. Safe to repeat: a
   * user with no data left yields zero counts. */
  eraseUser(userId: string, email: string): Promise<ErasureResult>;
}

export function createErasureRepository(prisma: PrismaClient): ErasureRepository {
  return {
    async eraseUser(userId, rawEmail) {
      const email = rawEmail.toLowerCase();
      return prisma.$transaction(async (tx) => {
        // Files first: once the rows are gone nothing says where the files are.
        const attachments = await tx.attachment.findMany({
          where: { OR: [{ ownerId: userId }, { message: { chat: { ownerId: userId } } }] },
          select: { storagePath: true },
        });

        // Owned chats go for everyone; members, messages and attachments cascade.
        const chats = await tx.chat.deleteMany({ where: { ownerId: userId } });
        // Pending invites to the address and memberships bound to the user (AICHAT-253).
        const memberships = await tx.chatMember.deleteMany({ where: { OR: [{ email }, { userId }] } });
        // The user's own messages in other people's chats; their attachments cascade.
        const messages = await tx.message.deleteMany({ where: { ownerId: userId } });
        await tx.attachment.deleteMany({ where: { ownerId: userId } });

        return {
          chats: chats.count,
          memberships: memberships.count,
          messages: messages.count,
          storagePaths: attachments.map((a) => a.storagePath),
        };
      });
    },
  };
}
