/**
 * Reusable JWT sign/verify utility for access tokens (PLAN.md B4).
 *
 * Contract for other services (e.g. `conversation-service`, owned by the `chat` pod) to
 * validate access tokens locally, with no network call, per ARCHITECTURE.md §4:
 *   - Cookie name: `access_token` (see `shared/contracts/auth.ts` `ACCESS_TOKEN_COOKIE`).
 *   - Algorithm: HS256, shared secret via the `JWT_SECRET` env var (must be identical
 *     across `auth-service` and every service that verifies the token locally).
 *   - Claims shape: `{ sub: userId, email, email_verified, iat, exp }` (see
 *     `shared/contracts/auth.ts` `accessTokenClaimsSchema`).
 *   - TTL: 15 minutes (`ACCESS_TOKEN_TTL_SECONDS`).
 *   - `verifyAccessToken` throws on a missing/expired/tampered token; callers should
 *     catch and respond `401`.
 */
import jwt from "jsonwebtoken";
import { auth } from "./contracts/index.js";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  /** Whether the user proved they control `email` (AICHAT-253); the `email_verified` claim. */
  emailVerified: boolean;
}

export function signAccessToken(payload: AccessTokenPayload, secret: string): string {
  return jwt.sign({ sub: payload.sub, email: payload.email, email_verified: payload.emailVerified }, secret, {
    algorithm: "HS256",
    expiresIn: auth.ACCESS_TOKEN_TTL_SECONDS,
  });
}

/**
 * Verifies an access token's signature and expiry, and validates the claims shape.
 * Throws (does not return null) on any failure — a missing/expired token, a bad
 * signature (secret mismatch / tampering), or a payload that doesn't match the expected
 * claims shape — so callers can use a single try/catch to produce a 401.
 */
export function verifyAccessToken(token: string, secret: string): auth.AccessTokenClaims {
  const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
  return auth.accessTokenClaimsSchema.parse(decoded);
}
