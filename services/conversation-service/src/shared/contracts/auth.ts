import { z } from "zod";

/**
 * Local mirror of `packages/shared-types/src/auth/*` (platform-owned).
 *
 * `packages/shared-types` is not resolvable from this pod's isolated worktree, so this
 * module intentionally mirrors the JWT/cookie contract defined by the `auth` pod (same
 * exported names, same claim shape) so call sites here can switch to
 * `import { auth } from "@shared-types"` with a one-line change once the workspace is
 * merged and the package is installable.
 *
 * DO NOT diverge from `packages/shared-types/src/auth/*` / `auth-service`'s
 * `src/shared/contracts/auth.ts` without coordinating with the `platform`/`auth` pods.
 */

export const accessTokenClaimsSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  /** True once the user proved they control `email` (AICHAT-253); absent in older tokens. */
  email_verified: z.boolean().optional(),
  iat: z.number().int(),
  exp: z.number().int(),
});
export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

export const ACCESS_TOKEN_COOKIE = "access_token";
