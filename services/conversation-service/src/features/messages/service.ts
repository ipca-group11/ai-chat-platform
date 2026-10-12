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
  /** The user stopped this reply before it finished (AICHAT-202). Missing on old fakes = false. */
  stopped?: boolean;
  /** When the message took its place in the conversation (AICHAT-191). Null while queued. */
  sentAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  attachments: AttachmentSummary[];
}

/** Conversation order (AICHAT-191): by the time a message took its place in the conversation,
 * falling back to its creation time (queued messages and rows from before `sentAt`), then id.
 * A message queued behind a reply is therefore listed after that reply, even if it was
 * written before the reply started. */
export function byConversationOrder(a: MessageRecord, b: MessageRecord): number {
  const placed = (m: MessageRecord) => (m.sentAt ?? m.createdAt).getTime();
  return placed(a) - placed(b) || a.createdAt.getTime() - b.createdAt.getTime() || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export interface MessagesRepository {
  create(data: {
    chatId: string;
    ownerId: string;
    authorEmail?: string | null;
    role: MessageRole;
    content: string;
    status: MessageStatus;
    sentAt?: Date;
  }): Promise<MessageRecord>;
  /** Every message of the chat in conversation order (`byConversationOrder`). */
  findByChatOrdered(chatId: string): Promise<MessageRecord[]>;
  findByIdAndOwner(id: string, ownerId: string): Promise<MessageRecord | null>;
  findById(id: string): Promise<MessageRecord | null>;
  /** `sentAt` is given when a queued user message starts its turn. */
  updateStatus(id: string, status: MessageStatus, sentAt?: Date): Promise<MessageRecord>;
  updateContent(
    id: string,
    data: {
      content: string;
      reasoning?: string | null;
      webFetches?: WebFetchDto[] | null;
      status: MessageStatus;
      error?: string | null;
      stopped?: boolean;
    },
  ): Promise<MessageRecord>;
  /** Resets a failed assistant reply of the chat to queued, in one conditional write; null
   * when it is not (or no longer) a failed reply. Two retries at once: only one gets it. */
  claimForRetry(id: string, chatId: string): Promise<MessageRecord | null>;
  /** Changes the text of a user message that is still queued, in one conditional write; null
   * once its reply has started (the processor marks it sent before it reads the history). */
  updateQueuedContent(id: string, content: string): Promise<MessageRecord | null>;
  delete(id: string): Promise<void>;
}

export function createMessagesRepository(prisma: PrismaClient): MessagesRepository {
  return {
    async create(data) {
      return prisma.message.create({ data, include: { attachments: true } });
    },
    async findByChatOrdered(chatId) {
      const rows = await prisma.message.findMany({
        where: { chatId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: { attachments: true },
      });
      return rows.sort(byConversationOrder);
    },
    async findByIdAndOwner(id, ownerId) {
      return prisma.message.findFirst({ where: { id, ownerId }, include: { attachments: true } });
    },
    async findById(id) {
      return prisma.message.findUnique({ where: { id }, include: { attachments: true } });
    },
    async updateStatus(id, status, sentAt) {
      return prisma.message.update({ where: { id }, data: { status, ...(sentAt ? { sentAt } : {}) }, include: { attachments: true } });
    },
    async updateContent(id, { webFetches, ...data }) {
      return prisma.message.update({
        where: { id },
        // A JSON column is cleared with DbNull, not null.
        data: { ...data, ...(webFetches !== undefined ? { webFetches: webFetches ?? Prisma.DbNull } : {}) },
        include: { attachments: true },
      });
    },
    async claimForRetry(id, chatId) {
      const { count } = await prisma.message.updateMany({
        where: { id, chatId, role: "assistant", status: "failed" },
        data: { content: "", status: "queued", error: null },
      });
      return count === 1 ? prisma.message.findUnique({ where: { id }, include: { attachments: true } }) : null;
    },
    async updateQueuedContent(id, content) {
      const { count } = await prisma.message.updateMany({ where: { id, role: "user", status: "queued" }, data: { content } });
      return count === 1 ? prisma.message.findUnique({ where: { id }, include: { attachments: true } }) : null;
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

    // Saved as queued; only the processor marks it sent, when its reply starts. Whether it
    // starts now is decided by `submit`, after the save: deciding before the await let two
    // sends at once both read "idle" (AICHAT-191).
    const userMessage = await this.repo.create({
      chatId,
      ownerId: user.userId,
      authorEmail: user.email,
      role: "user",
      content: input.content,
      status: "queued",
    });

    const result = this.queueManager.submit(chatId, {
      messageId: userMessage.id,
      content: input.content,
      attachmentIds: input.attachmentIds,
      apiKey,
      kind: "send",
      userId: user.userId,
    });

    const dto = toMessageDto(result === "started" ? { ...userMessage, status: "sent" } : userMessage);
    // Lets the other members viewing this chat see the message without a refetch.
    this.bus.publish(chatId, { type: "message", message: dto });
    if (result === "queued") {
      this.bus.publish(chatId, { type: "queued", messageId: userMessage.id });
    }

    return dto;
  }

  /** AC-58: edit a queued (not yet processing) message. Only its author may. */
  async editQueued(user: Principal, chatId: string, messageId: string, content: string): Promise<MessageDto> {
    await this.assertAuthor(user, chatId, messageId);
    // The saved text is what the reply is built from, so the database decides: the edit only
    // lands while the message is still queued (AICHAT-192). Checking the in-memory queue and
    // then writing left a gap in which the reply could start with the old text.
    const updated = await this.repo.updateQueuedContent(messageId, content);
    if (!updated) {
      throw new HttpError(409, "MESSAGE_NOT_EDITABLE", "Message is not queued and can no longer be edited");
    }
    this.queueManager.editQueued(chatId, messageId, content);
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
    // member may retry one (with their own API key). Check and reset are one conditional
    // write, so two retries at once cannot both get it (AICHAT-192).
    const reset = await this.repo.claimForRetry(messageId, chatId);
    if (!reset) {
      throw new HttpError(409, "MESSAGE_NOT_RETRYABLE", "Only a failed assistant message can be retried");
    }

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
    stopped: message.stopped ?? false,
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
