/**
 * Access-token verification (PLAN.md B4). Thin wrapper around `shared/jwt.ts` bound to
 * this service's `JWT_SECRET`, plus an Express `requireAuth` guard used by `GET /auth/me`
 * and reusable by any other route in this service that needs an authenticated request.
 *
 * Contract for other services (documented in `shared/jwt.ts`'s header comment too):
 * `conversation-service` (owned by the `chat` pod) should perform the equivalent
 * verification locally — read the `access_token` cookie, verify it as HS256 with the
 * same `JWT_SECRET`, and treat any failure as a 401 — without importing this module
 * directly (services don't share code at runtime), but the claims shape and cookie name
 * are the stable contract (`shared/contracts/auth.ts`).
 */
import type { NextFunction, Request, Response } from "express";
import { auth } from "../../shared/contracts/index.js";
import { env } from "../../shared/env.js";
import { HttpError } from "../../shared/error-middleware.js";
import { verifyAccessToken as verifyAccessTokenJwt } from "../../shared/jwt.js";

// Augment the *global* `Express.Request` namespace (not `declare module
// "express-serve-static-core"`): pnpm's per-package node_modules hoisting can give
// different files two distinct physical copies of `@types/express-serve-static-core`
// (own real directory vs. the one nested under `@types/express`'s resolution), which
// breaks module-specifier-based augmentation merging. `Express.Request` is what
// `@types/express-serve-static-core`'s own `Request<...>` interface extends, so this
// merges correctly regardless of which physical `@types/express-serve-static-core` copy
// ends up resolved.
declare global {
  // Required TS pattern for augmenting Express's ambient `Express.Request` global
  // namespace; not a "normal" TS namespace as an ES2015-module alternative.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
      userEmail?: string;
    }
  }
}

export function verifyAccessToken(token: string): auth.AccessTokenClaims {
  return verifyAccessTokenJwt(token, env.JWT_SECRET);
}

/** Express guard: requires a valid `access_token` cookie, else responds 401. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[auth.ACCESS_TOKEN_COOKIE] as string | undefined;
  if (!token) {
    next(new HttpError(401, "UNAUTHENTICATED", "Not authenticated"));
    return;
  }

  try {
    const claims = verifyAccessToken(token);
    req.userId = claims.sub;
    req.userEmail = claims.email;
    next();
  } catch {
    next(new HttpError(401, "UNAUTHENTICATED", "Not authenticated"));
  }
}
