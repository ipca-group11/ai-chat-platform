import { randomUUID } from "node:crypto";
import type { MessageRole, MessageStatus, WebFetchDto } from "../shared/contracts/chat.js";
import { byConversationOrder, type MessageRecord, type MessagesRepository } from "../features/messages/service.js";

/** In-memory `MessagesRepository` fake used across unit tests. */
export class FakeMessagesRepository implements MessagesRepository {
  private readonly messages = new Map<string, MessageRecord>();
  private created = 0;

  async create(data: {
    chatId: string;
    ownerId: string;
    authorEmail?: string | null;
    role: MessageRole;
    content: string;
    status: MessageStatus;
    sentAt?: Date;
  }): Promise<MessageRecord> {
    const now = new Date();
    const message: MessageRecord = {
      // Ids grow with creation order, like the database's cuid(): ties in time break the same way.
      id: `msg-${String((this.created += 1)).padStart(6, "0")}-${randomUUID().slice(0, 8)}`,
      createdAt: now,
      updatedAt: now,
      attachments: [],
      error: null,
      ...data,
      sentAt: data.sentAt ?? null,
      authorEmail: data.authorEmail ?? null,
    };
    this.messages.set(message.id, message);
    return message;
  }

  async findByChatOrdered(chatId: string): Promise<MessageRecord[]> {
    // Insertion order stands in for the database's (createdAt, id) order; then the same
    // conversation order the real repository applies.
    return [...this.messages.values()].filter((m) => m.chatId === chatId).sort(byConversationOrder);
  }

  async findByIdAndOwner(id: string, ownerId: string): Promise<MessageRecord | null> {
    const message = this.messages.get(id);
    if (!message || message.ownerId !== ownerId) return null;
    return message;
  }

  async findById(id: string): Promise<MessageRecord | null> {
    return this.messages.get(id) ?? null;
  }

  async updateStatus(id: string, status: MessageStatus, sentAt?: Date): Promise<MessageRecord> {
    const existing = this.get(id);
    const updated = { ...existing, status, ...(sentAt ? { sentAt } : {}), updatedAt: new Date() };
    this.messages.set(id, updated);
    return updated;
  }

  async updateContent(
    id: string,
    data: {
      content: string;
      reasoning?: string | null;
      webFetches?: WebFetchDto[] | null;
      status: MessageStatus;
      error?: string | null;
      stopped?: boolean;
    },
  ): Promise<MessageRecord> {
    const existing = this.get(id);
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.messages.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.messages.delete(id);
  }

  private get(id: string): MessageRecord {
    const existing = this.messages.get(id);
    if (!existing) throw new Error(`Message ${id} not found`);
    return existing;
  }

  seed(message: MessageRecord): void {
    this.messages.set(message.id, message);
  }

  has(id: string): boolean {
    return this.messages.has(id);
  }

  all(): MessageRecord[] {
    return [...this.messages.values()];
  }
}
