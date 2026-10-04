import type { MessagesRepository } from "../messages/index.js";
import type { AttachmentsRepository } from "./service.js";
import type { AttachmentStorage } from "./storage.js";

/** Finds the files that belong to a chat or a message and removes them once the database
 * rows are gone. Callers collect the paths first (the rows are needed to know them), delete
 * the rows, and only then call `remove`, so a failed database delete never loses files. */
export interface FileCleanup {
  collectForChat(chatId: string): Promise<string[]>;
  collectForMessage(messageId: string): Promise<string[]>;
  /** Best effort: a file that cannot be removed is reported to `onError` and does not fail the request. */
  remove(storagePaths: string[]): Promise<void>;
}

export function createFileCleanup(
  messagesRepo: MessagesRepository,
  attachmentsRepo: AttachmentsRepository,
  storage: AttachmentStorage,
  onError: (storagePath: string, error: unknown) => void = () => {},
): FileCleanup {
  return {
    async collectForChat(chatId) {
      const messages = await messagesRepo.findByChatOrdered(chatId);
      const records = await attachmentsRepo.findManyByMessageIds(messages.map((m) => m.id));
      return records.map((r) => r.storagePath);
    },
    async collectForMessage(messageId) {
      const records = await attachmentsRepo.findManyByMessageIds([messageId]);
      return records.map((r) => r.storagePath);
    },
    async remove(storagePaths) {
      await Promise.all(
        storagePaths.map(async (storagePath) => {
          try {
            await storage.delete(storagePath);
          } catch (error) {
            onError(storagePath, error);
          }
        }),
      );
    },
  };
}
