import type { AttachmentKind } from "../../../shared/types";

/** FR14/FR15: allowed attachment types and size limit, validated client- and server-side. */
export const ALLOWED_EXTENSIONS = [".txt", ".pdf", ".png", ".jpg", ".jpeg"] as const;
export const ALLOWED_MIME_TYPES = [
  "text/plain",
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB, per docs/STACK.md decision #3 / FR15.

export interface FileValidationError {
  code: "invalid_type" | "too_large";
  message: string;
}

function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx).toLowerCase();
}

/**
 * AC-67: only .txt/.pdf/.png/.jpeg(.jpg) are accepted; both extension and MIME
 * type are checked (a mismatched pair, e.g. a renamed .exe, is rejected).
 * AC-68: files over 10 MB or of a disallowed type are rejected before upload
 * with a clear, specific error message.
 */
export function validateAttachmentFile(file: File): FileValidationError | null {
  const extension = extensionOf(file.name);
  const extensionAllowed = (ALLOWED_EXTENSIONS as readonly string[]).includes(extension);
  const mimeAllowed = (ALLOWED_MIME_TYPES as readonly string[]).includes(file.type);

  if (!extensionAllowed || !mimeAllowed) {
    return {
      code: "invalid_type",
      message: `"${file.name}" is not a supported file type. Allowed types: .txt, .pdf, .png, .jpg/.jpeg.`,
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      code: "too_large",
      message: `"${file.name}" is larger than the 10 MB limit.`,
    };
  }

  return null;
}

export function attachmentKindFromMime(mimeType: string): AttachmentKind {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  return "text";
}
