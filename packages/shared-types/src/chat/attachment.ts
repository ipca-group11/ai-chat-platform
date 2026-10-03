import { z } from "zod";

/** Allowed attachment types (FR14, FR15). */
export const attachmentMimeTypeSchema = z.enum([
  "text/plain",
  "application/pdf",
  "image/png",
  "image/jpeg",
]);
export type AttachmentMimeType = z.infer<typeof attachmentMimeTypeSchema>;

export const ATTACHMENT_ALLOWED_EXTENSIONS = [".txt", ".pdf", ".png", ".jpeg", ".jpg"] as const;
export const ATTACHMENT_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB (FR15)

export const extractedTextStatusSchema = z.enum([
  "not_applicable",
  "pending",
  "extracted",
  "failed",
]);
export type ExtractedTextStatus = z.infer<typeof extractedTextStatusSchema>;

export const attachmentSchema = z.object({
  id: z.string(),
  messageId: z.string(),
  ownerId: z.string(),
  originalFilename: z.string().min(1),
  storedPath: z.string().min(1),
  mimeType: attachmentMimeTypeSchema,
  size: z.number().int().positive().max(ATTACHMENT_MAX_SIZE_BYTES),
  extractedTextStatus: extractedTextStatusSchema,
  createdAt: z.string().datetime(),
});
export type Attachment = z.infer<typeof attachmentSchema>;
