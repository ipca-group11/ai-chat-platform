import type { Attachment, Provider } from "../../../shared/types";
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
export declare function usePendingAttachments(chatId: string, provider: Provider, model: string): {
    pending: PendingAttachment[];
    addFiles: (files: FileList | File[]) => void;
    removePending: (id: string) => void;
    clear: () => void;
    uploadedAttachmentIds: string[];
    hasBlockingUploads: boolean;
};
