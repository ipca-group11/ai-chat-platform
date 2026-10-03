import type { AttachmentKind } from "../../shared/contracts/chat.js";

/** Extracts text content for text/PDF attachments so it can be included in the LLM
 * request context (AC-69). Images return `undefined` here — they are sent as image
 * input instead (AC-70), handled by the attachment-aware context builder. */
export async function extractText(kind: AttachmentKind, buffer: Buffer): Promise<string | undefined> {
  if (kind === "text") {
    return buffer.toString("utf-8");
  }

  if (kind === "pdf") {
    try {
      const { default: pdfParse } = await import("pdf-parse");
      const data = await pdfParse(buffer);
      return data.text;
    } catch {
      // Extraction failures (corrupt/unsupported PDF) shouldn't crash the upload; the
      // attachment is still stored, just without extracted text context.
      return undefined;
    }
  }

  return undefined;
}
