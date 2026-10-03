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

  async findManyAccessible(ownerId: string, email: string): Promise<ChatRecord[]> {
    return [...this.chats.values()]
      .filter((chat) => this.canAccess(chat, ownerId, email))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async findByIdAndOwner(id: string, ownerId: string): Promise<ChatRecord | null> {
    const chat = this.chats.get(id);
    if (!chat || chat.ownerId !== ownerId) return null;
    return chat;
  }

  async findAccessible(id: string, ownerId: string, email: string): Promise<ChatRecord | null> {
    const chat = this.chats.get(id);
    if (!chat || !this.canAccess(chat, ownerId, email)) return null;
    return chat;
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
    const member: ChatMemberRecord = { id: randomUUID(), createdAt: new Date(), ...data };
    this.members.push(member);
    return member;
  }

  async removeMember(chatId: string, email: string): Promise<boolean> {
    const before = this.members.length;
    this.members = this.members.filter((m) => !(m.chatId === chatId && m.email === email));
    return this.members.length < before;
  }

  private canAccess(chat: ChatRecord, ownerId: string, email: string): boolean {
    return chat.ownerId === ownerId || this.members.some((m) => m.chatId === chat.id && m.email === email);
  }

  seed(chat: ChatRecord): void {
    this.chats.set(chat.id, chat);
  }

  has(id: string): boolean {
    return this.chats.has(id);
  }
}
