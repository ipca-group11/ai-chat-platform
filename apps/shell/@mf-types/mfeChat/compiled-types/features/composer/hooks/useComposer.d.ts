import type { Provider } from "../../../shared/types";
export interface UseComposerArgs {
    chatId: string;
    userId: string;
    provider: Provider;
    model: string;
}
/**
 * Composer state/behavior: text content, staged attachments, and sending.
 * AC-51: sends the text message (persisted immediately server-side).
 * AC-66: attachments staged here are included by id when the message is sent.
 */
export declare function useComposer({ chatId, userId, provider, model }: UseComposerArgs): {
    content: string;
    setContent: import("react").Dispatch<import("react").SetStateAction<string>>;
    send: () => void;
    canSend: boolean;
    isSending: boolean;
    sendError: Error | null;
    attachments: {
        pending: import("../../attachments").PendingAttachment[];
        addFiles: (files: FileList | File[]) => void;
        removePending: (id: string) => void;
        clear: () => void;
        uploadedAttachmentIds: string[];
        hasBlockingUploads: boolean;
    };
};
