import { z } from "zod";

/**
 * Access token JWT claims (ARCHITECTURE.md §4): HS256, 15 min TTL, shared `JWT_SECRET`
 * between `auth-service` (issuer) and `conversation-service` (local verifier).
 */
export const accessTokenClaimsSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  iat: z.number().int(),
  exp: z.number().int(),
});
export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

export const ACCESS_TOKEN_COOKIE = "access_token";
export const REFRESH_TOKEN_COOKIE = "refresh_token";

/** STACK.md decision #2. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
