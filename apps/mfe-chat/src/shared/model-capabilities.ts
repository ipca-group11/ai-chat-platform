import { supportsReasoning as sharedSupportsReasoning, supportsWebFetch as sharedSupportsWebFetch } from "@app/shared-types/model-capabilities";
import type { Provider } from "./types";

/**
 * Which models can reason ("think") or fetch web pages, so the toggles are only offered
 * where they do something. The rules live in `packages/shared-types` (AICHAT-133), the same
 * ones conversation-service's adapters use, so the UI and the server cannot disagree.
 */
export function supportsWebFetch(provider: Provider, model: string): boolean {
  return sharedSupportsWebFetch(provider, model);
}

export function supportsReasoning(provider: Provider, model: string): boolean {
  return sharedSupportsReasoning(provider, model);
}
