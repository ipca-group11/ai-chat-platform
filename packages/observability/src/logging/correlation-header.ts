import { randomUUID } from "node:crypto";

/**
 * Correlation ID header name (`STACK.md` decision #8). This is a local mirror of
 * `packages/shared-types`'s `CORRELATION_HEADER`/`getOrCreateCorrelationId`
 * (`packages/shared-types/src/http/correlation-id.ts`, owned by `platform-foundation`).
 * Kept local so `packages/observability` can be linted/typechecked/tested in isolation
 * without a hard build-order dependency on another pod's in-progress package; the two
 * must be reconciled to a single source of truth at integration time (flagged in this
 * pod's PLAN.md under "Cross-pod dependencies" / "Known gaps"), at which point this file
 * should re-export from `@shared-types` instead of duplicating the logic.
 */
export const CORRELATION_HEADER = "X-Correlation-Id";

/**
 * Reads the correlation ID off an incoming request's headers (case-insensitive, as Node's
 * `IncomingMessage.headers` already lower-cases keys), generating a fresh UUID if one
 * isn't already present.
 */
export function getOrCreateCorrelationId(
  headers: Record<string, string | string[] | undefined>,
): string {
  const existing =
    headers[CORRELATION_HEADER] ?? headers[CORRELATION_HEADER.toLowerCase()];
  const value = Array.isArray(existing) ? existing[0] : existing;

  return value && value.length > 0 ? value : randomUUID();
}
