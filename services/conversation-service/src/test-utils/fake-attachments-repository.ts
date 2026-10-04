import { randomUUID } from "node:crypto";
import type { AttachmentKind } from "../shared/contracts/chat.js";
import type { AttachmentRecord, AttachmentsRepository, LinkedAttachmentRecord } from "../features/attachments/service.js";

const isLinked = (a: AttachmentRecord): a is LinkedAttachmentRecord => a.messageId !== null;

export class FakeAttachmentsRepository implements AttachmentsRepository {
  private readonly attachments = new Map<string, AttachmentRecord>();

  async create(data: {
    messageId: string | null;
    chatId?: string;
    ownerId: string;
    filename: string;
    mimeType: string;
    size: number;
    kind: AttachmentKind;
    storagePath: string;
    extractedText: string | null;
  }): Promise<AttachmentRecord> {
    const record: AttachmentRecord = { id: randomUUID(), createdAt: new Date(), ...data, chatId: data.chatId ?? null };
    this.attachments.set(record.id, record);
    return record;
  }

  async findManyByMessageIds(messageIds: string[]): Promise<LinkedAttachmentRecord[]> {
    return [...this.attachments.values()].filter(isLinked).filter((a) => messageIds.includes(a.messageId));
  }

  async linkToMessage(
    ids: string[],
    { chatId, ownerId, messageId }: { chatId: string; ownerId: string; messageId: string },
  ): Promise<LinkedAttachmentRecord[]> {
    const linked: LinkedAttachmentRecord[] = [];
    for (const id of ids) {
      const a = this.attachments.get(id);
      if (!a || a.chatId !== chatId || a.ownerId !== ownerId || a.messageId !== null) continue;
      const updated = { ...a, messageId };
      this.attachments.set(id, updated);
      linked.push(updated);
    }
    return linked;
  }

  async findReferencedPaths(storagePaths: string[]): Promise<Set<string>> {
    const wanted = new Set(storagePaths);
    return new Set([...this.attachments.values()].map((a) => a.storagePath).filter((p) => wanted.has(p)));
  }

  all(): AttachmentRecord[] {
    return [...this.attachments.values()];
  }
}
