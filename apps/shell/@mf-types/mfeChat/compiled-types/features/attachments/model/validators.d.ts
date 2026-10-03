import type { AttachmentKind } from "../../../shared/types";
/** FR14/FR15: allowed attachment types and size limit, validated client- and server-side. */
export declare const ALLOWED_EXTENSIONS: readonly [".txt", ".pdf", ".png", ".jpg", ".jpeg"];
export declare const ALLOWED_MIME_TYPES: readonly ["text/plain", "application/pdf", "image/png", "image/jpeg"];
export declare const MAX_FILE_SIZE_BYTES: number;
export interface FileValidationError {
    code: "invalid_type" | "too_large";
    message: string;
}
/**
 * AC-67: only .txt/.pdf/.png/.jpeg(.jpg) are accepted; both extension and MIME
 * type are checked (a mismatched pair, e.g. a renamed .exe, is rejected).
 * AC-68: files over 10 MB or of a disallowed type are rejected before upload
 * with a clear, specific error message.
 */
export declare function validateAttachmentFile(file: File): FileValidationError | null;
export declare function attachmentKindFromMime(mimeType: string): AttachmentKind;
