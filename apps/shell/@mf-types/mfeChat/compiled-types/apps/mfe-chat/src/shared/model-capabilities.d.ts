import type { Provider } from "./types";
/**
 * Which models can reason ("think") or fetch web pages, so the toggles are only offered
 * where they do something. The rules live in `packages/shared-types` (AICHAT-133), the same
 * ones conversation-service's adapters use, so the UI and the server cannot disagree.
 */
export declare function supportsWebFetch(provider: Provider, model: string): boolean;
export declare function supportsReasoning(provider: Provider, model: string): boolean;
