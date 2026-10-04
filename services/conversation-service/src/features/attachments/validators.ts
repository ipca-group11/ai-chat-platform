import path from "node:path";
import { HttpError } from "../../shared/error-handler.js";
import type { AttachmentKind } from "../../shared/contracts/chat.js";

export interface AllowedType {
  extension: string;
  mimeType: string;
  kind: AttachmentKind;
}

/** Accepted attachment types (AC-67): extension AND MIME type must both match one of
 * these entries. */
export const ALLOWED_TYPES: AllowedType[] = [
  { extension: ".txt", mimeType: "text/plain", kind: "text" },
  { extension: ".pdf", mimeType: "application/pdf", kind: "pdf" },
  { extension: ".png", mimeType: "image/png", kind: "image" },
  { extension: ".jpg", mimeType: "image/jpeg", kind: "image" },
  { extension: ".jpeg", mimeType: "image/jpeg", kind: "image" },
];

export interface UploadCandidate {
  originalname: string;
  mimetype: string;
  size: number;
}

/** Validates extension + MIME type + size server-side (AC-67), rejecting with a clear,
 * specific error message (AC-68) before the file is stored. */
export function validateAttachment(
  file: UploadCandidate,
  maxBytes: number,
): { extension: string; kind: AttachmentKind } {
  const extension = path.extname(file.originalname).toLowerCase();
  const allowed = ALLOWED_TYPES.find((t) => t.extension === extension);

  if (!allowed) {
    throw new HttpError(
      400,
      "ATTACHMENT_TYPE_NOT_ALLOWED",
      `Files of type "${extension || "unknown"}" are not allowed. Accepted types: .txt, .pdf, .png, .jpeg, .jpg`,
    );
  }

  if (file.mimetype !== allowed.mimeType) {
    throw new HttpError(
      400,
      "ATTACHMENT_TYPE_NOT_ALLOWED",
      `File "${file.originalname}" has a MIME type ("${file.mimetype}") that does not match its extension`,
    );
  }

  if (file.size > maxBytes) {
    const limitMb = Math.floor(maxBytes / (1024 * 1024));
    throw new HttpError(
      413,
      "ATTACHMENT_TOO_LARGE",
      `File "${file.originalname}" exceeds the ${limitMb} MB size limit`,
    );
  }

  return { extension, kind: allowed.kind };
}
