/**
 * Public API of `packages/shared-types` (AC-8, AC-11). Feature-folder convention: only
 * this file is imported by consumers (`@shared-types` / `@shared-types/*` per
 * `tsconfig.base.json`); nothing inside `src/auth`, `src/chat`, `src/http` is imported
 * directly from outside this package other than via the `auth`/`chat`/`http` re-exports
 * below (kept as sub-paths for tree-shaking/readability, not raw internals).
 */
export * as auth from "./auth";
export * as chat from "./chat";
export * as http from "./http";
export * as modelCapabilities from "./model-capabilities";
