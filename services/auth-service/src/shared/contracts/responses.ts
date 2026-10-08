import { z } from "zod";

/**
 * Response bodies of the JSON routes (AICHAT-184). register, login and `GET /auth/me` all send
 * `{ id, email }`; `authResponseSchema` (`{ user: { ... } }`, mirrored from shared-types) is not
 * what any route returns. The OpenAPI spec (`src/openapi/document.ts`) and the response
 * validation tests use these.
 */

export const healthResponseSchema = z.object({ status: z.literal("ok") });

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;
