import { randomUUID } from "node:crypto";
import type { AttachmentKind } from "../shared/contracts/chat.js";
import type { AttachmentRecord, AttachmentsRepository } from "../features/attachments/service.js";

export class FakeAttachmentsRepository implements AttachmentsRepository {
  private readonly attachments = new Map<string, AttachmentRecord>();

  async create(data: {
    messageId: string;
    ownerId: string;
    filename: string;
    mimeType: string;
    size: number;
    kind: AttachmentKind;
    storagePath: string;
    extractedText: string | null;
  }): Promise<AttachmentRecord> {
    const record: AttachmentRecord = { id: randomUUID(), createdAt: new Date(), ...data };
    this.attachments.set(record.id, record);
    return record;
  }

  async findManyByMessageIds(messageIds: string[]): Promise<AttachmentRecord[]> {
    return [...this.attachments.values()].filter((a) => messageIds.includes(a.messageId));
  }

  all(): AttachmentRecord[] {
    return [...this.attachments.values()];
  }
}
