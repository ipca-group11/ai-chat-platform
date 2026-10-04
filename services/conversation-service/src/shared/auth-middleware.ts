import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { ACCESS_TOKEN_COOKIE, accessTokenClaimsSchema } from "./contracts/auth.js";
import { HttpError } from "./error-handler.js";

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
      userId: string;
      /** Lowercased `email` claim; what a pending chat invite is claimed with. */
      userEmail: string;
      /** The `email_verified` claim; false when absent (AICHAT-253). */
      userEmailVerified: boolean;
    }
  }
}

/**
 * Validates the `access_token` cookie locally against the shared `JWT_SECRET`
 * (ARCHITECTURE.md §4, STACK.md decision #1) — no network call to `auth-service`.
 * Also accepts an `Authorization: Bearer <token>` header as a fallback for
 * non-browser/contract-test clients. Sets `req.userId` from the token's `sub` claim,
 * `req.userEmail` from its `email` claim and `req.userEmailVerified` from `email_verified`.
 * Missing/invalid/expired token -> 401.
 */
export function authMiddleware(jwtSecret: string) {
  return function authMiddlewareHandler(req: Request, _res: Response, next: NextFunction) {
    const token = extractToken(req);
    if (!token) {
      next(new HttpError(401, "UNAUTHENTICATED", "Missing or invalid access token"));
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret, { algorithms: ["HS256"] });
      const claims = accessTokenClaimsSchema.parse(decoded);
      req.userId = claims.sub;
      req.userEmail = claims.email.toLowerCase();
      req.userEmailVerified = claims.email_verified === true;
      next();
    } catch {
      next(new HttpError(401, "UNAUTHENTICATED", "Missing or invalid access token"));
    }
  };
}

/** The authenticated caller, as the chat features need it (id for ownership and bound
 * memberships; a verified email to claim a pending invite). */
export interface Principal {
  userId: string;
  email: string;
  /** Whether the email is proven (`email_verified` claim). Unverified users never claim an invite. */
  emailVerified: boolean;
}

export function principalFrom(req: Request): Principal {
  return { userId: req.userId, email: req.userEmail, emailVerified: req.userEmailVerified };
}

function extractToken(req: Request): string | undefined {
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.[ACCESS_TOKEN_COOKIE];
  if (cookieToken) return cookieToken;

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }
  return undefined;
}
