/**
 * Local mirror of `packages/shared-types/src/http/*` (platform-owned). See the header
 * comment in `./auth.ts` for why this mirror exists and when to remove it.
 */
import { randomUUID } from "node:crypto";
import { z } from "zod";

/** Correlation ID header name (STACK.md decision #8). */
export const CORRELATION_HEADER = "X-Correlation-Id";

/** Header used by the browser to forward a per-request LLM provider API key
 * (ARCHITECTURE.md §6, settings pod's AC-82/83). Read/forwarded/redacted here, never
 * persisted. */
// HTTP header name, not a secret (WAIVERS.md W2)
// nosemgrep: node_api_key
export const LLM_API_KEY_HEADER = "X-Llm-Api-Key";

export interface HeaderReader {
  get(name: string): string | null | undefined;
}

export function getOrCreateCorrelationId(
  headers: HeaderReader | Record<string, string | string[] | undefined>,
): string {
  const existing = isHeaderReader(headers)
    ? headers.get(CORRELATION_HEADER)
    : (headers[CORRELATION_HEADER] ?? headers[CORRELATION_HEADER.toLowerCase()]);

  const value = Array.isArray(existing) ? existing[0] : existing;

  return value && value.length > 0 ? value : randomUUID();
}

function isHeaderReader(value: unknown): value is HeaderReader {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as HeaderReader).get === "function"
  );
}

/** Uniform error body returned for every non-2xx response. */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    fieldErrors: z.record(z.string(), z.array(z.string())).optional(),
  }),
  correlationId: z.string().optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

export function toErrorResponse(
  code: string,
  message: string,
  options?: { fieldErrors?: Record<string, string[]>; correlationId?: string },
): ErrorResponse {
  return {
    error: {
      code,
      message,
      ...(options?.fieldErrors ? { fieldErrors: options.fieldErrors } : {}),
    },
    ...(options?.correlationId ? { correlationId: options.correlationId } : {}),
  };
}
