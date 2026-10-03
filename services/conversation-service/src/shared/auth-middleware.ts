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
      /** Lowercased `email` claim; what chat memberships are matched against. */
      userEmail: string;
    }
  }
}

/**
 * Validates the `access_token` cookie locally against the shared `JWT_SECRET`
 * (ARCHITECTURE.md §4, STACK.md decision #1) — no network call to `auth-service`.
 * Also accepts an `Authorization: Bearer <token>` header as a fallback for
 * non-browser/contract-test clients. Sets `req.userId` from the token's `sub` claim and
 * `req.userEmail` from its `email` claim.
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
      next();
    } catch {
      next(new HttpError(401, "UNAUTHENTICATED", "Missing or invalid access token"));
    }
  };
}

/** The authenticated caller, as the chat features need it (id for ownership, email for
 * membership). */
export interface Principal {
  userId: string;
  email: string;
}

export function principalFrom(req: Request): Principal {
  return { userId: req.userId, email: req.userEmail };
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
