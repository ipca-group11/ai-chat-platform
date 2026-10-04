import type { chat } from "@app/shared-types";
import { HttpError } from "../backend/http.js";
import type { MockUser } from "../data/types.js";
import type { MockContext } from "../registry.js";
import type { AttachmentDto, ChatDto, ChatMemberDto, MessageDto } from "./contract.js";

/** A message record of the dataset, plus the fields the service keeps for its DTO. */
export type StoredMessage = chat.Message & {
  authorId?: string;
  authorEmail?: string | null;
  error?: string | null;
  /** The model stopped at its output token limit (AICHAT-212). */
  truncated?: boolean;
};

export const nowIso = (): string => new Date().toISOString();

const issued = new WeakMap<object, Map<string, number>>();

/**
 * `prefix_00042`: one above the highest id with that prefix in `ids`. Ids are not reused after a
 * delete or cancel; the count starts again with the next dataset (seed or reset).
 */
export function nextId(ctx: MockContext, prefix: string, ids: Iterable<string>): string {
  const counters = issued.get(ctx.store.data) ?? new Map<string, number>();
  issued.set(ctx.store.data, counters);
  let highest = counters.get(prefix) ?? 0;
  for (const id of ids) {
    const match = new RegExp(`^${prefix}_(\\d+)$`).exec(id);
    if (match) highest = Math.max(highest, Number(match[1]));
  }
  counters.set(prefix, highest + 1);
  return `${prefix}_${String(highest + 1).padStart(5, "0")}`;
}

export const emailOfUser = (ctx: MockContext, userId: string): string | null =>
  ctx.store.data.users.find((user) => user.id === userId)?.email ?? null;

export function findChat(ctx: MockContext, chatId: string): chat.Chat | undefined {
  return ctx.store.data.chats.find((candidate) => candidate.id === chatId);
}

export function findMessage(ctx: MockContext, messageId: string): StoredMessage | undefined {
  return ctx.store.data.messages.find((message) => message.id === messageId);
}

const notFound = () => new HttpError(404, "CHAT_NOT_FOUND", "Chat not found");

/** The chat when the user owns it or was invited to it; 404 otherwise, like the service. */
export function accessibleChat(ctx: MockContext, user: MockUser, chatId: string): chat.Chat {
  const found = findChat(ctx, chatId);
  const isMember = ctx.store.data.members.some(
    (member) => member.chatId === chatId && member.role === "member" && member.email === user.email,
  );
  if (!found || (found.ownerId !== user.id && !isMember)) throw notFound();
  return found;
}

/** The chat when the user owns it; 404 otherwise. */
export function ownedChat(ctx: MockContext, user: MockUser, chatId: string): chat.Chat {
  const found = findChat(ctx, chatId);
  if (!found || found.ownerId !== user.id) throw notFound();
  return found;
}

export function toChatDto(ctx: MockContext, record: chat.Chat): ChatDto {
  return { ...record, ownerEmail: emailOfUser(ctx, record.ownerId) };
}

/** The owner first, then the invited members in the order they were added. */
export function membersOf(ctx: MockContext, record: chat.Chat): ChatMemberDto[] {
  const invited = ctx.store.data.members
    .filter((member) => member.chatId === record.id && member.role === "member")
    .map((member): ChatMemberDto => ({ email: member.email, role: "member", addedAt: member.addedAt }));
  return [{ email: emailOfUser(ctx, record.ownerId), role: "owner", addedAt: record.createdAt }, ...invited];
}

const KIND_OF_MIME: Record<chat.AttachmentMimeType, AttachmentDto["kind"]> = {
  "text/plain": "text",
  "application/pdf": "pdf",
  "image/png": "image",
  "image/jpeg": "image",
};

export function toAttachmentDto(record: chat.Attachment): AttachmentDto {
  return {
    id: record.id,
    messageId: record.messageId,
    filename: record.originalFilename,
    mimeType: record.mimeType,
    size: record.size,
    kind: KIND_OF_MIME[record.mimeType],
    createdAt: record.createdAt,
  };
}

const STATUS_OF: Record<chat.MessageStatus, MessageDto["status"]> = {
  queued: "queued",
  streaming: "streaming",
  complete: "sent",
  failed: "failed",
  canceled: "failed",
};

export function toMessageDto(ctx: MockContext, record: StoredMessage): MessageDto {
  const owner = findChat(ctx, record.chatId)?.ownerId ?? "";
  const authorId = record.authorId ?? owner;
  const attachments = ctx.store.data.attachments.filter(
    (attachment) => attachment.messageId === record.id || record.attachmentIds.includes(attachment.id),
  );
  return {
    id: record.id,
    chatId: record.chatId,
    authorId,
    authorEmail: record.authorEmail ?? (record.role === "user" ? emailOfUser(ctx, authorId) : null),
    role: record.role,
    content: record.content,
    reasoning: record.reasoning ?? null,
    webFetches: record.webFetches ?? [],
    attachments: attachments.map(toAttachmentDto),
    status: STATUS_OF[record.status],
    error: record.error ?? (record.status === "failed" ? "The provider returned an error" : null),
    truncated: record.truncated ?? false,
    createdAt: record.createdAt,
  };
}

/** Messages of a chat in the order they were written; canceled ones are gone, as in the service. */
export function messagesOf(ctx: MockContext, chatId: string): StoredMessage[] {
  return ctx.store.data.messages.filter((message) => message.chatId === chatId && message.status !== "canceled");
}

/** Removes a chat and everything that hangs from it. */
export function removeChat(ctx: MockContext, chatId: string): void {
  const data = ctx.store.data;
  const messageIds = new Set(data.messages.filter((message) => message.chatId === chatId).map((m) => m.id));
  data.chats = data.chats.filter((candidate) => candidate.id !== chatId);
  data.members = data.members.filter((member) => member.chatId !== chatId);
  data.messages = data.messages.filter((message) => message.chatId !== chatId);
  data.attachments = data.attachments.filter((attachment) => !messageIds.has(attachment.messageId));
}
