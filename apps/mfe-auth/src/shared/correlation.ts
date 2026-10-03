// Correlation ID contract (STACK.md decision #8).
//
// TODO(platform): `packages/shared-types` is expected to export this same constant and a
// generator helper for use by every mfe/service. This module is a local fallback so
// `mfe-auth` can ship independently; once `packages/shared-types` lands, replace this
// import with `import { CORRELATION_HEADER } from '@repo/shared-types'` and delete this
// file (keep the same export names to make the swap a no-op for consumers).

export const CORRELATION_HEADER = "X-Correlation-Id";

export function generateCorrelationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without the Web Crypto UUID helper (older test runners).
  return `corr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
