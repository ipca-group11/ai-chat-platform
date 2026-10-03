import type { chat } from "@app/shared-types";
import { fixtures } from "./fixtures";

// The shapes that conversation-service sends and the microfrontends read. They follow the
// mapping of the mock server (testing/mock-server/src/conversation/records.ts): the stored
// record becomes a DTO with an owner email, message statuses `sent`/`failed` and attachments inline.

export function toAttachmentDto(record: chat.Attachment) {
  return {
    id: record.id,
    messageId: record.messageId,
    filename: record.originalFilename,
    mimeType: record.mimeType,
    size: record.size,
    kind: record.mimeType.startsWith("image/") ? "image" : record.mimeType === "application/pdf" ? "pdf" : "text",
    createdAt: record.createdAt,
  };
}

export function toChatDto(record: chat.Chat, ownerEmail: string = fixtures.user.email) {
  return { ...record, ownerEmail };
}

export function toMessageDto(record: chat.Message, attachments: chat.Attachment[] = []) {
  return {
    id: record.id,
    chatId: record.chatId,
    authorId: fixtures.user.id,
    authorEmail: record.role === "user" ? fixtures.user.email : null,
    role: record.role,
    content: record.content,
    reasoning: record.reasoning ?? null,
    webFetches: record.webFetches ?? [],
    attachments: attachments.map(toAttachmentDto),
    status: record.status === "complete" ? "sent" : record.status === "canceled" ? "failed" : record.status,
    error: record.status === "failed" ? "The provider returned an error" : null,
    createdAt: record.createdAt,
  };
}
