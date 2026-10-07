import type { Principal } from "../../shared/auth-middleware.js";
import { z } from "zod";
import { Prisma } from "../../generated/prisma-client/index.js";
import type { PrismaClient } from "../../shared/prisma.js";
import { HttpError } from "../../shared/error-handler.js";
import {
  webFetchDtoSchema,
  type MessageDto,
  type MessageRole,
  type MessageStatus,
  type WebFetchDto,
} from "../../shared/contracts/chat.js";
import type { FileCleanup } from "../attachments/index.js";
import type { ChatsService } from "../chats/index.js";
import type { QueueManager } from "../queue/index.js";
import type { ChatEventBus } from "../streaming/index.js";
import type { SendMessageInput } from "./schema.js";

export interface AttachmentSummary {
  id: string;
  messageId: string;
  filename: string;
  mimeType: string;
  size: number;
  kind: "text" | "pdf" | "image";
  createdAt: Date;
}

export interface MessageRecord {
  id: string;
  chatId: string;
  ownerId: string;
  authorEmail: string | null;
  role: MessageRole;
  content: string;
  reasoning?: string | null;
  /** `WebFetchDto[]` as stored (a JSON column); validated when mapped to a DTO. */
  webFetches?: unknown;
  status: MessageStatus;
  error?: string | null;
  createdAt: Date;
  updatedAt: Date;
  attachments: AttachmentSummary[];
}

export interface MessagesRepository {
  create(data: {
    chatId: string;
    ownerId: string;
    authorEmail?: string | null;
    role: MessageRole;
    content: string;
    status: MessageStatus;
  }): Promise<MessageRecord>;
  findByChatOrdered(chatId: string): Promise<MessageRecord[]>;
  findByIdAndOwner(id: string, ownerId: string): Promise<MessageRecord | null>;
  findById(id: string): Promise<MessageRecord | null>;
  updateStatus(id: string, status: MessageStatus): Promise<MessageRecord>;
  updateContent(
    id: string,
    data: {
      content: string;
      reasoning?: string | null;
      webFetches?: WebFetchDto[] | null;
      status: MessageStatus;
      error?: string | null;
    },
  ): Promise<MessageRecord>;
  delete(id: string): Promise<void>;
}

export function createMessagesRepository(prisma: PrismaClient): MessagesRepository {
  return {
    async create(data) {
      return prisma.message.create({ data, include: { attachments: true } });
    },
    async findByChatOrdered(chatId) {
      return prisma.message.findMany({
        where: { chatId },
        orderBy: { createdAt: "asc" },
        include: { attachments: true },
      });
    },
    async findByIdAndOwner(id, ownerId) {
      return prisma.message.findFirst({ where: { id, ownerId }, include: { attachments: true } });
    },
    async findById(id) {
      return prisma.message.findUnique({ where: { id }, include: { attachments: true } });
    },
    async updateStatus(id, status) {
      return prisma.message.update({ where: { id }, data: { status }, include: { attachments: true } });
    },
    async updateContent(id, { webFetches, ...data }) {
      return prisma.message.update({
        where: { id },
        // A JSON column is cleared with DbNull, not null.
        data: { ...data, ...(webFetches !== undefined ? { webFetches: webFetches ?? Prisma.DbNull } : {}) },
        include: { attachments: true },
      });
    },
    async delete(id) {
      await prisma.message.delete({ where: { id } });
    },
  };
}

export class MessagesService {
  constructor(
    private readonly repo: MessagesRepository,
    private readonly chatsService: ChatsService,
    private readonly queueManager: QueueManager,
    private readonly bus: ChatEventBus,
    private readonly files?: FileCleanup,
  ) {}

  /** AC-43/55: full chat history, restored on reload/relogin. */
  async list(user: Principal, chatId: string): Promise<MessageDto[]> {
    await this.chatsService.getAccessible(user, chatId);
    const messages = await this.repo.findByChatOrdered(chatId);
    return messages.map(toMessageDto);
  }

  /** AC-51: persisted immediately. AC-56: queued if the chat is busy, started
   * otherwise. Any chat member may send; the reply is generated with the sender's own
   * API key. */
  async send(user: Principal, chatId: string, input: SendMessageInput, apiKey?: string): Promise<MessageDto> {
    await this.chatsService.getAccessible(user, chatId);

    const queue = this.queueManager.getQueue(chatId);
    const isIdle = !queue.isProcessing;
    const userMessage = await this.repo.create({
      chatId,
      ownerId: user.userId,
      authorEmail: user.email,
      role: "user",
      content: input.content,
      status: isIdle ? "sent" : "queued",
    });

    this.queueManager.submit(chatId, {
      messageId: userMessage.id,
      content: input.content,
      attachmentIds: input.attachmentIds,
      apiKey,
      kind: "send",
      userId: user.userId,
    });

    const dto = toMessageDto(userMessage);
    // Lets the other members viewing this chat see the message without a refetch.
    this.bus.publish(chatId, { type: "message", message: dto });
    if (!isIdle) {
      this.bus.publish(chatId, { type: "queued", messageId: userMessage.id });
    }

    return dto;
  }

  /** AC-58: edit a queued (not yet processing) message. Only its author may. */
  async editQueued(user: Principal, chatId: string, messageId: string, content: string): Promise<MessageDto> {
    await this.assertAuthor(user, chatId, messageId);
    const ok = this.queueManager.editQueued(chatId, messageId, content);
    if (!ok) {
      throw new HttpError(409, "MESSAGE_NOT_EDITABLE", "Message is not queued and can no longer be edited");
    }
    const updated = await this.repo.updateContent(messageId, { content, status: "queued" });
    return toMessageDto(updated);
  }

  /** AC-58: cancel a queued (not yet processing) message. Only its author may. */
  async cancelQueued(user: Principal, chatId: string, messageId: string): Promise<void> {
    await this.assertAuthor(user, chatId, messageId);
    const ok = this.queueManager.cancelQueued(chatId, messageId);
    if (!ok) {
      throw new HttpError(409, "MESSAGE_NOT_CANCELABLE", "Message is not queued and can no longer be canceled");
    }
    const storagePaths = (await this.files?.collectForMessage(messageId)) ?? [];
    await this.repo.delete(messageId);
    await this.files?.remove(storagePaths);
  }

  /** AC-54: stop the in-progress stream for a chat; the partial response is saved by the
   * processor when the provider call is aborted. */
  async stop(user: Principal, chatId: string): Promise<{ stopped: boolean }> {
    await this.chatsService.getAccessible(user, chatId);
    return { stopped: this.queueManager.stop(chatId) };
  }

  /** AICHAT-203: on logout, auth-service asks to stop every reply the user started
   * (service-to-service, so no user session is checked here). */
  stopAllForUser(userId: string): { stopped: number } {
    return { stopped: this.queueManager.stopForUser(userId) };
  }

  /** AC-73: retry a message that previously failed due to a provider error. */
  async retry(user: Principal, chatId: string, messageId: string, apiKey?: string): Promise<MessageDto> {
    await this.chatsService.getAccessible(user, chatId);
    // Not scoped to the caller: assistant replies belong to the chat owner, and any
    // member may retry one (with their own API key).
    const message = await this.repo.findById(messageId);
    if (!message || message.chatId !== chatId || message.role !== "assistant" || message.status !== "failed") {
      throw new HttpError(409, "MESSAGE_NOT_RETRYABLE", "Only a failed assistant message can be retried");
    }

    const reset = await this.repo.updateContent(messageId, { content: "", status: "queued", error: null });
    this.queueManager.submit(chatId, {
      messageId,
      content: "",
      attachmentIds: [],
      apiKey,
      kind: "retry",
      userId: user.userId,
    });
    return toMessageDto(reset);
  }

  private async assertAuthor(user: Principal, chatId: string, messageId: string): Promise<void> {
    await this.chatsService.getAccessible(user, chatId);
    const message = await this.repo.findByIdAndOwner(messageId, user.userId);
    if (!message || message.chatId !== chatId) {
      throw new HttpError(404, "MESSAGE_NOT_FOUND", "Message not found");
    }
  }
}

const savedWebFetches = z.array(webFetchDtoSchema);

export function toMessageDto(message: MessageRecord): MessageDto {
  return {
    id: message.id,
    chatId: message.chatId,
    authorId: message.ownerId,
    authorEmail: message.authorEmail,
    role: message.role,
    content: message.content,
    reasoning: message.reasoning ?? null,
    webFetches: savedWebFetches.safeParse(message.webFetches ?? []).data ?? [],
    status: message.status,
    error: message.error ?? null,
    attachments: message.attachments.map((a) => ({
      id: a.id,
      messageId: a.messageId,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      kind: a.kind,
      createdAt: a.createdAt.toISOString(),
    })),
    createdAt: message.createdAt.toISOString(),
  };
}
