import type { LlmMessage, LlmMessageAttachment } from "../llm-adapters/index.js";
import type { MessageRecord } from "../messages/index.js";
import type { AttachmentRecord, AttachmentsRepository } from "./service.js";
import type { AttachmentStorage } from "./storage.js";

/**
 * Builds an attachment-aware `buildLlmMessages` function for `createMessageProcessor`
 * (composed in `app.ts`, kept out of the `messages` feature so it doesn't need to know
 * about attachment internals): extracted text is inlined for text/PDF attachments
 * (AC-69) and image bytes are base64-encoded for vision-capable models (AC-70).
 */
export function createAttachmentAwareContextBuilder(repo: AttachmentsRepository, storage: AttachmentStorage) {
  return async function buildLlmMessages(messages: MessageRecord[]): Promise<LlmMessage[]> {
    const messageIds = messages.map((m) => m.id);
    const attachments = messageIds.length > 0 ? await repo.findManyByMessageIds(messageIds) : [];

    const byMessage = new Map<string, AttachmentRecord[]>();
    for (const attachment of attachments) {
      const list = byMessage.get(attachment.messageId) ?? [];
      list.push(attachment);
      byMessage.set(attachment.messageId, list);
    }

    const result: LlmMessage[] = [];
    for (const message of messages) {
      const messageAttachments = byMessage.get(message.id) ?? [];
      const llmAttachments: LlmMessageAttachment[] = [];

      for (const attachment of messageAttachments) {
        if (attachment.kind === "image") {
          const bytes = await storage.read(attachment.storagePath);
          llmAttachments.push({
            kind: "image",
            content: bytes.toString("base64"),
            mimeType: attachment.mimeType,
            filename: attachment.filename,
          });
        } else if (attachment.extractedText) {
          llmAttachments.push({
            kind: "text",
            content: attachment.extractedText,
            mimeType: attachment.mimeType,
            filename: attachment.filename,
          });
        }
      }

      result.push({
        role: message.role,
        content: message.content,
        ...(llmAttachments.length > 0 ? { attachments: llmAttachments } : {}),
      });
    }

    return result;
  };
}
