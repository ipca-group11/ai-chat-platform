import type { PrismaClient } from "../../shared/prisma.js";
import { HttpError } from "../../shared/error-handler.js";
import type { Principal } from "../../shared/auth-middleware.js";
import type { ChatDto, ChatMemberDto, Provider } from "../../shared/contracts/chat.js";
import type { FileCleanup } from "../attachments/index.js";
import type { CreateChatInput, UpdateChatInput } from "./schema.js";

export interface ChatRecord {
  id: string;
  ownerId: string;
  ownerEmail: string | null;
  title: string;
  provider: Provider;
  model: string;
  reasoning: boolean;
  webFetch: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMemberRecord {
  id: string;
  chatId: string;
  email: string;
  /** The user the invite is bound to; null until a verified user with `email` claims it. */
  userId: string | null;
  invitedBy: string;
  createdAt: Date;
}

/** Narrow slice of the Prisma client this feature depends on, so unit tests can supply
 * an in-memory fake instead of a real Postgres connection. */
export interface ChatsRepository {
  create(data: {
    ownerId: string;
    ownerEmail: string;
    title: string;
    provider: Provider;
    model: string;
    reasoning?: boolean;
    webFetch?: boolean;
  }): Promise<ChatRecord>;
  /** Chats the user owns or is a bound member of (matched on the user id, never the email). */
  findManyAccessible(userId: string): Promise<ChatRecord[]>;
  findByIdAndOwner(id: string, ownerId: string): Promise<ChatRecord | null>;
  findAccessible(id: string, userId: string): Promise<ChatRecord | null>;
  /** Binds the still unclaimed invites for `email` (of one chat, or all) to `userId`. Returns how many. */
  claimInvites(email: string, userId: string, chatId?: string): Promise<number>;
  /** Unscoped lookup for trusted internal callers only (e.g. the queue processor, which
   * already validated ownership when the message was first submitted) — never exposed
   * directly to a per-request handler. */
  findById(id: string): Promise<ChatRecord | null>;
  update(id: string, data: Partial<Pick<ChatRecord, "title" | "provider" | "model" | "reasoning" | "webFetch">>): Promise<ChatRecord>;
  delete(id: string): Promise<void>;
  listMembers(chatId: string): Promise<ChatMemberRecord[]>;
  addMember(data: { chatId: string; email: string; invitedBy: string }): Promise<ChatMemberRecord>;
  /** Returns false when there was no such member. */
  removeMember(chatId: string, email: string): Promise<boolean>;
  /** Removes the membership bound to `userId` (a member leaving). False when there was none. */
  removeMemberByUser(chatId: string, userId: string): Promise<boolean>;
}

export function createChatsRepository(prisma: PrismaClient): ChatsRepository {
  return {
    async create(data) {
      return prisma.chat.create({ data });
    },
    async findManyAccessible(userId) {
      return prisma.chat.findMany({
        where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
        orderBy: { updatedAt: "desc" },
      });
    },
    async findByIdAndOwner(id, ownerId) {
      // Scoped by ownerId in the query itself (defense in depth for AC-45/46/47), not
      // just filtered after the fact.
      return prisma.chat.findFirst({ where: { id, ownerId } });
    },
    async findAccessible(id, userId) {
      return prisma.chat.findFirst({ where: { id, OR: [{ ownerId: userId }, { members: { some: { userId } } }] } });
    },
    async claimInvites(email, userId, chatId) {
      const { count } = await prisma.chatMember.updateMany({ where: { email, userId: null, ...(chatId ? { chatId } : {}) }, data: { userId } });
      return count;
    },
    async findById(id) {
      return prisma.chat.findUnique({ where: { id } });
    },
    async update(id, data) {
      return prisma.chat.update({ where: { id }, data });
    },
    async delete(id) {
      // `onDelete: Cascade` on Message/Attachment removes children (AC-44).
      await prisma.chat.delete({ where: { id } });
    },
    async listMembers(chatId) {
      return prisma.chatMember.findMany({ where: { chatId }, orderBy: { createdAt: "asc" } });
    },
    async addMember(data) {
      return prisma.chatMember.create({ data });
    },
    async removeMember(chatId, email) {
      const { count } = await prisma.chatMember.deleteMany({ where: { chatId, email } });
      return count > 0;
    },
    async removeMemberByUser(chatId, userId) {
      const { count } = await prisma.chatMember.deleteMany({ where: { chatId, userId } });
      return count > 0;
    },
  };
}

export class ChatsService {
  constructor(
    private readonly repo: ChatsRepository,
    private readonly files?: FileCleanup,
  ) {}

  async list(user: Principal): Promise<ChatDto[]> {
    await this.claimInvites(user);
    const chats = await this.repo.findManyAccessible(user.userId);
    return chats.map(toChatDto);
  }

  /**
   * Binds the pending invites for the user's email to their id (AICHAT-253, pentest H1). Only a
   * verified email may claim: registering someone else's address gives an unverified account,
   * which never matches an invite. Once bound, an invite is matched on the user id only, so a
   * later account with the same address (after the first one was deleted) gets nothing.
   */
  private async claimInvites(user: Principal, chatId?: string): Promise<number> {
    if (!user.emailVerified) return 0;
    return this.repo.claimInvites(user.email, user.userId, chatId);
  }

  async create(user: Principal, input: CreateChatInput): Promise<ChatDto> {
    const chat = await this.repo.create({ ownerId: user.userId, ownerEmail: user.email, ...input });
    return toChatDto(chat);
  }

  /** Loads a chat scoped to its owner, or throws 404 (AC-45/46). Guards the owner-only
   * operations: rename, provider/model/reasoning/web fetch change, delete, managing members. */
  async getOwned(ownerId: string, chatId: string): Promise<ChatRecord> {
    const chat = await this.repo.findByIdAndOwner(chatId, ownerId);
    if (!chat) {
      throw new HttpError(404, "CHAT_NOT_FOUND", "Chat not found");
    }
    return chat;
  }

  /** Loads a chat the user owns or is a member of, or throws 404 (AC-45/46). Guards
   * everything members may do: read history, send/retry/stop messages, stream. */
  async getAccessible(user: Principal, chatId: string): Promise<ChatRecord> {
    let chat = await this.repo.findAccessible(chatId, user.userId);
    if (!chat && (await this.claimInvites(user, chatId)) > 0) {
      chat = await this.repo.findAccessible(chatId, user.userId);
    }
    if (!chat) {
      throw new HttpError(404, "CHAT_NOT_FOUND", "Chat not found");
    }
    return chat;
  }

  async get(user: Principal, chatId: string): Promise<ChatDto> {
    const chat = await this.getAccessible(user, chatId);
    return toChatDto(chat);
  }

  /** Trusted internal lookup (no ownership check) for the queue processor. */
  async findById(chatId: string): Promise<ChatRecord | null> {
    return this.repo.findById(chatId);
  }

  async update(ownerId: string, chatId: string, input: UpdateChatInput): Promise<ChatDto> {
    await this.getOwned(ownerId, chatId);
    const updated = await this.repo.update(chatId, input);
    return toChatDto(updated);
  }

  async remove(ownerId: string, chatId: string): Promise<void> {
    await this.getOwned(ownerId, chatId);
    // The rows tell where the files are, so read them first, but remove the files only after
    // the database delete went through (AICHAT-97).
    const storagePaths = (await this.files?.collectForChat(chatId)) ?? [];
    await this.repo.delete(chatId);
    await this.files?.remove(storagePaths);
  }

  /** The owner first, then invited members in the order they were added. */
  async listMembers(user: Principal, chatId: string): Promise<ChatMemberDto[]> {
    const chat = await this.getAccessible(user, chatId);
    const members = await this.repo.listMembers(chatId);
    return [
      { email: chat.ownerEmail, role: "owner", addedAt: chat.createdAt.toISOString() },
      ...members.map((m): ChatMemberDto => ({ email: m.email, role: "member", addedAt: m.createdAt.toISOString() })),
    ];
  }

  /** Owner-only. The invitee may not have registered yet: the invite is claimed by the first
   * user who opens it with that email *verified*, and bound to their id from then on. */
  async addMember(user: Principal, chatId: string, email: string): Promise<ChatMemberDto> {
    await this.getOwned(user.userId, chatId);
    if (email === user.email) {
      throw new HttpError(400, "CANNOT_INVITE_SELF", "You already own this chat");
    }
    const existing = await this.repo.listMembers(chatId);
    if (existing.some((m) => m.email === email)) {
      throw new HttpError(409, "ALREADY_A_MEMBER", "That user is already a member of this chat");
    }
    const member = await this.repo.addMember({ chatId, email, invitedBy: user.userId });
    return { email: member.email, role: "member", addedAt: member.createdAt.toISOString() };
  }

  /** The owner can remove anyone; a member can only remove themselves (leave). */
  async removeMember(user: Principal, chatId: string, email: string): Promise<void> {
    const chat = await this.getAccessible(user, chatId);
    const isOwner = chat.ownerId === user.userId;
    if (!isOwner && email !== user.email) {
      throw new HttpError(403, "FORBIDDEN", "Only the chat owner can remove other members");
    }
    // A member leaving removes the membership bound to them, not whatever row carries the address.
    const removed = isOwner ? await this.repo.removeMember(chatId, email) : await this.repo.removeMemberByUser(chatId, user.userId);
    if (!removed) {
      throw new HttpError(404, "MEMBER_NOT_FOUND", "Member not found");
    }
  }

  /** A member leaves a chat shared with them. The owner can't leave (they delete). */
  async leave(user: Principal, chatId: string): Promise<void> {
    const chat = await this.getAccessible(user, chatId);
    if (chat.ownerId === user.userId) {
      throw new HttpError(409, "OWNER_CANNOT_LEAVE", "The chat owner cannot leave their own chat. Delete the chat instead.");
    }
    const removed = await this.repo.removeMember(chatId, user.email);
    if (!removed) {
      throw new HttpError(404, "MEMBER_NOT_FOUND", "Member not found");
    }
  }
}

export function toChatDto(chat: ChatRecord): ChatDto {
  return {
    id: chat.id,
    title: chat.title,
    ownerId: chat.ownerId,
    ownerEmail: chat.ownerEmail,
    provider: chat.provider,
    model: chat.model,
    reasoning: chat.reasoning,
    webFetch: chat.webFetch,
    createdAt: chat.createdAt.toISOString(),
    updatedAt: chat.updatedAt.toISOString(),
  };
}
