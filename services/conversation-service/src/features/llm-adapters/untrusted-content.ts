import { UNTRUSTED_TAG } from "../../shared/system-prompt.js";
import type { LlmMessage, LlmMessageAttachment } from "./types.js";

/**
 * Text and PDF attachments reach the model as untrusted data (AICHAT-244, AICHAT-26 finding F4).
 *
 * Their text is appended to the message, each file inside `<untrusted-content>` tags that the
 * system prompt (src/shared/system-prompt.ts) tells the model to treat as data, never as
 * instructions. A file cannot close the tag early: a closing or opening tag inside its text is
 * defused, and the filename is escaped.
 */

const TAG_PATTERN = new RegExp(`<(/?)\\s*${UNTRUSTED_TAG}`, "gi");

/** A zero-width space put after `<` / `</`, so a tag in the file text no longer reads as the wrapper's tag. */
const BREAK = "​";

/** Breaks any `<untrusted-content` / `</untrusted-content` inside the file text, so it stays inside its wrapper. */
function defuse(text: string): string {
  return text.replace(TAG_PATTERN, (_match, slash: string) => `<${slash}${BREAK}${UNTRUSTED_TAG}`);
}

const attribute = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/[\r\n]+/g, " ");

/** One text attachment, wrapped and marked as untrusted. */
export function wrapUntrusted(attachment: Pick<LlmMessageAttachment, "filename" | "mimeType" | "content">): string {
  return [
    `<${UNTRUSTED_TAG} source="attachment" filename="${attribute(attachment.filename)}" type="${attribute(attachment.mimeType)}">`,
    defuse(attachment.content),
    `</${UNTRUSTED_TAG}>`,
  ].join("\n");
}

/**
 * The text the adapters send for a message: its own text, then every text attachment wrapped as
 * untrusted content. Images are sent separately by each adapter in its own format.
 */
export function messageText(message: LlmMessage): string {
  const files = (message.attachments ?? []).filter((a) => a.kind === "text");
  if (files.length === 0) return message.content;
  return [message.content, ...files.map(wrapUntrusted)].join("\n\n");
}
