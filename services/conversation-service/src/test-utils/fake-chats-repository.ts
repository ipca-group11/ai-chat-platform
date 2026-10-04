import { randomUUID } from "node:crypto";
import type { ChatMemberRecord, ChatRecord, ChatsRepository } from "../features/chats/service.js";
import type { Provider } from "../shared/contracts/chat.js";

/** In-memory `ChatsRepository` fake used across unit tests so business logic (ownership
 * isolation, cascade behavior at the service boundary, etc.) can be tested without a
 * real Postgres connection. */
export class FakeChatsRepository implements ChatsRepository {
  private readonly chats = new Map<string, ChatRecord>();
  private members: ChatMemberRecord[] = [];

  async create(data: {
    ownerId: string;
    ownerEmail: string;
    title: string;
    provider: Provider;
    model: string;
    reasoning?: boolean;
    webFetch?: boolean;
  }): Promise<ChatRecord> {
    const now = new Date();
    const chat: ChatRecord = { id: randomUUID(), createdAt: now, updatedAt: now, ...data, reasoning: data.reasoning ?? false, webFetch: data.webFetch ?? false };
    this.chats.set(chat.id, chat);
    return chat;
  }

  async findManyAccessible(userId: string): Promise<ChatRecord[]> {
    return [...this.chats.values()]
      .filter((chat) => this.canAccess(chat, userId))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async findByIdAndOwner(id: string, ownerId: string): Promise<ChatRecord | null> {
    const chat = this.chats.get(id);
    if (!chat || chat.ownerId !== ownerId) return null;
    return chat;
  }

  async findAccessible(id: string, userId: string): Promise<ChatRecord | null> {
    const chat = this.chats.get(id);
    if (!chat || !this.canAccess(chat, userId)) return null;
    return chat;
  }

  async claimInvites(email: string, userId: string, chatId?: string): Promise<number> {
    let count = 0;
    for (const member of this.members) {
      if (member.email === email && member.userId === null && (chatId === undefined || member.chatId === chatId)) {
        member.userId = userId;
        count++;
      }
    }
    return count;
  }

  async findById(id: string): Promise<ChatRecord | null> {
    return this.chats.get(id) ?? null;
  }

  async update(id: string, data: Partial<Pick<ChatRecord, "title" | "provider" | "model" | "reasoning" | "webFetch">>): Promise<ChatRecord> {
    const existing = this.chats.get(id);
    if (!existing) throw new Error(`Chat ${id} not found`);
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.chats.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.chats.delete(id);
    this.members = this.members.filter((m) => m.chatId !== id);
  }

  async listMembers(chatId: string): Promise<ChatMemberRecord[]> {
    return this.members.filter((m) => m.chatId === chatId);
  }

  async addMember(data: { chatId: string; email: string; invitedBy: string }): Promise<ChatMemberRecord> {
    const member: ChatMemberRecord = { id: randomUUID(), createdAt: new Date(), userId: null, ...data };
    this.members.push(member);
    return member;
  }

  async removeMember(chatId: string, email: string): Promise<boolean> {
    const before = this.members.length;
    this.members = this.members.filter((m) => !(m.chatId === chatId && m.email === email));
    return this.members.length < before;
  }

  async removeMemberByUser(chatId: string, userId: string): Promise<boolean> {
    const before = this.members.length;
    this.members = this.members.filter((m) => !(m.chatId === chatId && m.userId === userId));
    return this.members.length < before;
  }

  private canAccess(chat: ChatRecord, userId: string): boolean {
    return chat.ownerId === userId || this.members.some((m) => m.chatId === chat.id && m.userId === userId);
  }

  seed(chat: ChatRecord): void {
    this.chats.set(chat.id, chat);
  }

  has(id: string): boolean {
    return this.chats.has(id);
  }
}
