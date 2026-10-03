import { z } from "zod";

/**
 * Local mirror of `packages/shared-types/src/auth/*` (platform-owned).
 *
 * This pod's PLAN.md directs us to "fall back to an equivalent local schema only if
 * `platform` hasn't landed it yet, then switch to the shared one." `packages/shared-types`
 * is not resolvable from this pod's isolated worktree, so this module intentionally
 * mirrors its shape (same exported names, same validation rules, same cookie/claims
 * contract) so every call site here can switch to `import { auth } from "@shared-types"`
 * with a one-line change once the workspace is merged and the package is installable.
 *
 * DO NOT diverge from `packages/shared-types/src/auth/*` without coordinating with the
 * `platform` pod — this file exists only to unblock this pod's own build/tests.
 */

// --- password-policy (STACK.md decision #4) --------------------------------------
export const PASSWORD_MIN_LENGTH = 8;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, {
    message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters long`,
  })
  .regex(/[A-Za-z]/, { message: "Password must contain at least one letter" })
  .regex(/[0-9]/, { message: "Password must contain at least one number" });

export type Password = z.infer<typeof passwordSchema>;

export function isValidPassword(value: string): boolean {
  return passwordSchema.safeParse(value).success;
}

// --- DTOs --------------------------------------------------------------------------
export const registerRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: passwordSchema,
});
export type RegisterRequest = z.infer<typeof registerRequestSchema>;

export const loginRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const userProfileSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});
export type UserProfile = z.infer<typeof userProfileSchema>;

export const authResponseSchema = z.object({
  user: userProfileSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

// --- JWT / cookie contract (ARCHITECTURE.md §4) -------------------------------------
export const accessTokenClaimsSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  iat: z.number().int(),
  exp: z.number().int(),
});
export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
