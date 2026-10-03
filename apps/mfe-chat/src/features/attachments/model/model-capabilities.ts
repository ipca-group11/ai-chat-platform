import type { AttachmentKind, Provider } from "../../../shared/types";

/**
 * Best-effort, client-side model capability lookup used to warn the user
 * *before* sending (AC-71). `conversation-service` (BE-5/BE-6) is the
 * authoritative source: if this table drifts from reality, the server's error
 * response is surfaced instead (see `useUploadAttachment`), so this table
 * being slightly stale never lets an unsupported attachment reach the LLM
 * unnoticed — it only affects how early the user is warned.
 */
const VISION_CAPABLE_MODELS: Partial<Record<Provider, readonly string[]>> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-5-mini", "o4-mini"],
  anthropic: ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-4-5", "claude-3-5-sonnet-latest"],
};

export function supportsAttachmentKind(provider: Provider, model: string, kind: AttachmentKind): boolean {
  if (kind === "text" || kind === "pdf") return true;
  return VISION_CAPABLE_MODELS[provider]?.includes(model) ?? false;
}
