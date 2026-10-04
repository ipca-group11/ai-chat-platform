import { useState } from "react";
import type { Attachment, Provider } from "../../../shared/types";
import { ApiError } from "../../../shared/api-client";
import { useUploadAttachment } from "../api/useUploadAttachment";
import { supportsAttachmentKind } from "../model/model-capabilities";
import { attachmentKindFromMime, tooLargeMessage, validateAttachmentFile } from "../model/validators";

export interface PendingAttachment {
  id: string;
  file: File;
  status: "validating" | "uploading" | "uploaded" | "rejected";
  error?: string;
  attachment?: Attachment;
}

/**
 * Manages the set of files staged on a not-yet-sent message.
 * AC-66: attach one or more files to a message.
 * AC-67/AC-68: files are validated (type + size) before upload, with a clear,
 * specific error message per rejected file.
 * AC-71: files whose kind (e.g. image) the chat's model can't handle are
 * rejected before sending, with a clear message.
 */
export function usePendingAttachments(chatId: string, provider: Provider, model: string) {
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const uploadAttachment = useUploadAttachment(chatId);

  function addFiles(files: FileList | File[]) {
    for (const file of Array.from(files)) {
      const id = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const typeError = validateAttachmentFile(file);
      if (typeError) {
        setPending((existing) => [...existing, { id, file, status: "rejected", error: typeError.message }]);
        continue;
      }

      const kind = attachmentKindFromMime(file.type);
      if (!supportsAttachmentKind(provider, model, kind)) {
        setPending((existing) => [
          ...existing,
          {
            id,
            file,
            status: "rejected",
            error: `The selected model (${provider}/${model}) does not support ${kind} attachments.`,
          },
        ]);
        continue;
      }

      setPending((existing) => [...existing, { id, file, status: "uploading" }]);
      // mutateAsync, not mutate(file, { onSuccess }): per-call mutate callbacks only fire for the
      // latest call, so with several files picked at once all but the last stayed "uploading".
      uploadAttachment.mutateAsync(file).then(
        (attachment) => {
          setPending((existing) =>
            existing.map((p) => (p.id === id ? { ...p, status: "uploaded", attachment } : p))
          );
        },
        (error: Error) => {
          // 413 can also come from a proxy with a non-JSON body, so word it here.
          const message = error instanceof ApiError && error.status === 413 ? tooLargeMessage(file) : error.message;
          setPending((existing) =>
            existing.map((p) => (p.id === id ? { ...p, status: "rejected", error: message } : p))
          );
        },
      );
    }
  }

  function removePending(id: string) {
    setPending((existing) => existing.filter((p) => p.id !== id));
  }

  function clear() {
    setPending([]);
  }

  const uploadedAttachmentIds = pending.filter((p) => p.status === "uploaded" && p.attachment).map((p) => p.attachment!.id);
  const hasBlockingUploads = pending.some((p) => p.status === "uploading");

  return { pending, addFiles, removePending, clear, uploadedAttachmentIds, hasBlockingUploads };
}
