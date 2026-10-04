/**
 * Retention job of conversation-service (GDPR Art. 5(1)(e), AICHAT-137; periods in docs/AICHAT-33/RETENTION.md):
 * uploaded files that no attachment row points to (left behind by a failed delete or a crashed upload) are
 * removed once they are older than 24 hours. Chats, messages and attachments are kept until the user deletes
 * them or the account, so they are not touched here.
 *
 * `runRetention` takes the time as a parameter and has no timers of its own, so tests drive it with any
 * clock. Repeating it is harmless: a second run finds no orphan left.
 */
import type { AttachmentsRepository, AttachmentStorage } from "../attachments/index.js";

export const ORPHAN_FILE_GRACE_HOURS = 24;

export interface RetentionDeps {
  storage: AttachmentStorage;
  attachmentsRepo: AttachmentsRepository;
  onFileError?: (storagePath: string, error: unknown) => void;
}

export interface RetentionResult {
  /** Files older than the grace period that were looked at. */
  checked: number;
  orphansDeleted: number;
}

/** Files last modified before this moment may be removed when nothing references them. */
export function orphanFileCutoff(now: Date): Date {
  return new Date(now.getTime() - ORPHAN_FILE_GRACE_HOURS * 60 * 60 * 1000);
}

export async function runRetention(now: Date, { storage, attachmentsRepo, onFileError }: RetentionDeps): Promise<RetentionResult> {
  const cutoff = orphanFileCutoff(now);
  // A fresh upload is saved before its attachment row exists; the grace period keeps it out of reach.
  const old = (await storage.list()).filter((file) => file.modifiedAt.getTime() < cutoff.getTime());
  const referenced = await attachmentsRepo.findReferencedPaths(old.map((file) => file.storagePath));

  let orphansDeleted = 0;
  for (const file of old) {
    if (referenced.has(file.storagePath)) continue;
    try {
      await storage.delete(file.storagePath);
      orphansDeleted += 1;
    } catch (error) {
      onFileError?.(file.storagePath, error);
    }
  }
  return { checked: old.length, orphansDeleted };
}
