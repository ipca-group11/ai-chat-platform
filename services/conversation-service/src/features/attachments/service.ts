import type { Principal } from "../../shared/auth-middleware.js";
import type { PrismaClient } from "../../shared/prisma.js";
import { HttpError } from "../../shared/error-handler.js";
import type { AttachmentDto, AttachmentKind } from "../../shared/contracts/chat.js";
import type { ChatsService } from "../chats/index.js";
import type { MessagesRepository } from "../messages/index.js";
import type { ProviderRegistry } from "../llm-adapters/index.js";
import { validateAttachment, type UploadCandidate } from "./validators.js";
import { extractText } from "./text-extractor.js";
import type { AttachmentStorage } from "./storage.js";

export interface AttachmentRecord {
  id: string;
  /** Null until the message it was uploaded for is sent (AICHAT-245). */
  messageId: string | null;
  chatId: string | null;
  ownerId: string;
  filename: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  storagePath: string;
  extractedText: string | null;
  createdAt: Date;
}

/** An attachment that belongs to a message. */
export type LinkedAttachmentRecord = AttachmentRecord & { messageId: string };

export interface AttachmentsRepository {
  create(data: {
    messageId: string | null;
    chatId?: string;
    ownerId: string;
    filename: string;
    mimeType: string;
    size: number;
    kind: AttachmentKind;
    storagePath: string;
    extractedText: string | null;
  }): Promise<AttachmentRecord>;
  findManyByMessageIds(messageIds: string[]): Promise<LinkedAttachmentRecord[]>;
  /** Links the caller's not-yet-sent uploads of this chat to `messageId`; ids that are
   * unknown, someone else's, of another chat or already sent are left alone. */
  linkToMessage(ids: string[], target: { chatId: string; ownerId: string; messageId: string }): Promise<LinkedAttachmentRecord[]>;
  /** Which of these storage paths are referenced by an attachment row. */
  findReferencedPaths(storagePaths: string[]): Promise<Set<string>>;
}

export function createAttachmentsRepository(prisma: PrismaClient): AttachmentsRepository {
  return {
    async create(data) {
      return prisma.attachment.create({ data });
    },
    async findManyByMessageIds(messageIds) {
      if (messageIds.length === 0) return [];
      const rows = await prisma.attachment.findMany({ where: { messageId: { in: messageIds } } });
      return rows.filter(isLinked);
    },
    async linkToMessage(ids, { chatId, ownerId, messageId }) {
      if (ids.length === 0) return [];
      await prisma.attachment.updateMany({
        where: { id: { in: ids }, chatId, ownerId, messageId: null },
        data: { messageId },
      });
      const rows = await prisma.attachment.findMany({ where: { id: { in: ids }, messageId } });
      return rows.filter(isLinked);
    },
    async findReferencedPaths(storagePaths) {
      if (storagePaths.length === 0) return new Set();
      const rows = await prisma.attachment.findMany({ where: { storagePath: { in: storagePaths } }, select: { storagePath: true } });
      return new Set(rows.map((r) => r.storagePath));
    },
  };
}

function isLinked(record: AttachmentRecord): record is LinkedAttachmentRecord {
  return record.messageId !== null;
}

export interface UploadFile extends UploadCandidate {
  buffer: Buffer;
}

export class AttachmentsService {
  constructor(
    private readonly repo: AttachmentsRepository,
    private readonly chatsService: ChatsService,
    private readonly messagesRepo: MessagesRepository,
    private readonly storage: AttachmentStorage,
    private readonly providerRegistry: ProviderRegistry,
    private readonly maxBytes: number,
  ) {}

  /** AC-66: attach one or more files to a message. Validates type/size (AC-67/68),
   * rejects images the chat's selected model can't accept (AC-71), extracts text for
   * text/PDF (AC-69), and stores the file (STACK.md decision #3). Without a `messageId`
   * the file waits for the message the web client sends next, which names it in
   * `attachmentIds` (AICHAT-245). */
  async upload(user: Principal, chatId: string, messageId: string | undefined, file: UploadFile): Promise<AttachmentDto> {
    const chat = await this.chatsService.getAccessible(user, chatId);

    // Only the message's author can attach files to it.
    if (messageId !== undefined) {
      const message = await this.messagesRepo.findByIdAndOwner(messageId, user.userId);
      if (!message || message.chatId !== chatId) {
        throw new HttpError(404, "MESSAGE_NOT_FOUND", "Message not found");
      }
    }

    const { extension, kind } = validateAttachment(file, this.maxBytes);

    if (kind === "image") {
      const provider = this.providerRegistry.get(chat.provider);
      if (!provider.supportsVision(chat.model)) {
        throw new HttpError(
          422,
          "ATTACHMENT_NOT_SUPPORTED",
          `The selected model ("${chat.model}") does not support image attachments. Choose a vision-capable model or remove the image.`,
        );
      }
    }

    const storagePath = await this.storage.save(file.buffer, extension);
    const extractedText = (await extractText(kind, file.buffer)) ?? null;

    const record = await this.repo.create({
      messageId: messageId ?? null,
      chatId,
      ownerId: user.userId,
      filename: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      kind,
      storagePath,
      extractedText,
    });

    return toAttachmentDto(record);
  }
}

export function toAttachmentDto(record: AttachmentRecord): AttachmentDto {
  return {
    id: record.id,
    // Empty until the message is sent; the DTO keeps a plain string (AICHAT-245).
    messageId: record.messageId ?? "",
    filename: record.filename,
    mimeType: record.mimeType,
    size: record.size,
    kind: record.kind,
    createdAt: record.createdAt.toISOString(),
  };
}
