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
  messageId: string;
  ownerId: string;
  filename: string;
  mimeType: string;
  size: number;
  kind: AttachmentKind;
  storagePath: string;
  extractedText: string | null;
  createdAt: Date;
}

export interface AttachmentsRepository {
  create(data: {
    messageId: string;
    ownerId: string;
    filename: string;
    mimeType: string;
    size: number;
    kind: AttachmentKind;
    storagePath: string;
    extractedText: string | null;
  }): Promise<AttachmentRecord>;
  findManyByMessageIds(messageIds: string[]): Promise<AttachmentRecord[]>;
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
      return prisma.attachment.findMany({ where: { messageId: { in: messageIds } } });
    },
    async findReferencedPaths(storagePaths) {
      if (storagePaths.length === 0) return new Set();
      const rows = await prisma.attachment.findMany({ where: { storagePath: { in: storagePaths } }, select: { storagePath: true } });
      return new Set(rows.map((r) => r.storagePath));
    },
  };
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
   * text/PDF (AC-69), and stores the file (STACK.md decision #3). */
  async upload(user: Principal, chatId: string, messageId: string, file: UploadFile): Promise<AttachmentDto> {
    const chat = await this.chatsService.getAccessible(user, chatId);

    // Only the message's author can attach files to it.
    const message = await this.messagesRepo.findByIdAndOwner(messageId, user.userId);
    if (!message || message.chatId !== chatId) {
      throw new HttpError(404, "MESSAGE_NOT_FOUND", "Message not found");
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
      messageId,
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
    messageId: record.messageId,
    filename: record.filename,
    mimeType: record.mimeType,
    size: record.size,
    kind: record.kind,
    createdAt: record.createdAt.toISOString(),
  };
}
