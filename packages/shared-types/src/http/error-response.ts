import { z } from "zod";

/**
 * Uniform error body returned by `auth-service` and `conversation-service` for every
 * non-2xx response, so `mfe-*` apps can handle errors generically.
 */
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    /** Present for 400s from zod validation — field path -> message. */
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
