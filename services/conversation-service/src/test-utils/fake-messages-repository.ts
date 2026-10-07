import { randomUUID } from "node:crypto";
import type { MessageRole, MessageStatus, WebFetchDto } from "../shared/contracts/chat.js";
import type { MessageRecord, MessagesRepository } from "../features/messages/service.js";

/** In-memory `MessagesRepository` fake used across unit tests. */
export class FakeMessagesRepository implements MessagesRepository {
  private readonly messages = new Map<string, MessageRecord>();

  async create(data: { chatId: string; ownerId: string; authorEmail?: string | null; role: MessageRole; content: string; status: MessageStatus }): Promise<MessageRecord> {
    const now = new Date();
    const message: MessageRecord = { id: randomUUID(), createdAt: now, updatedAt: now, attachments: [], error: null, ...data, authorEmail: data.authorEmail ?? null };
    this.messages.set(message.id, message);
    return message;
  }

  async findByChatOrdered(chatId: string): Promise<MessageRecord[]> {
    return [...this.messages.values()]
      .filter((m) => m.chatId === chatId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async findByIdAndOwner(id: string, ownerId: string): Promise<MessageRecord | null> {
    const message = this.messages.get(id);
    if (!message || message.ownerId !== ownerId) return null;
    return message;
  }

  async findById(id: string): Promise<MessageRecord | null> {
    return this.messages.get(id) ?? null;
  }

  async updateStatus(id: string, status: MessageStatus): Promise<MessageRecord> {
    const existing = this.get(id);
    const updated = { ...existing, status, updatedAt: new Date() };
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
