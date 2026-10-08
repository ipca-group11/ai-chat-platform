import { Router } from "express";
import { auth } from "../../shared/contracts/index.js";
import { HttpError } from "../../shared/error-middleware.js";
import type { PrismaClient } from "../../generated/prisma-client/index.js";
import { prisma as defaultPrisma } from "../../shared/prisma.js";
import { clearAuthCookies, setAuthCookies } from "./cookies.js";
import {
  getUserById,
  issueTokens,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyCredentials,
} from "./model.js";
import { requireAuth } from "./verify.js";
import type { ReplyStopClient } from "../../shared/reply-stop-client.js";

export interface SessionRouterOptions {
  /** Stops the user's running replies on logout (AICHAT-203). Undefined when
   * INTERNAL_SERVICE_TOKEN or CONVERSATION_SERVICE_URL is not configured. */
  replies?: ReplyStopClient;
  /** Told when stopping the replies fails; logout still succeeds. */
  onReplyStopError?: (err: unknown, userId: string) => void;
}

function invalidCredentials(): HttpError {
  return new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password");
}

function invalidRefreshToken(): HttpError {
  return new HttpError(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
}

/** Builds the session router around the given Prisma client (injectable for tests). */
export function createSessionRouter(prisma: PrismaClient, options: SessionRouterOptions = {}): Router {
  const sessionRouter: Router = Router();

  sessionRouter.post("/login", async (req, res, next) => {
    try {
      const parsed = auth.loginRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        // Malformed input is treated the same as wrong credentials (AC-36): never reveal
        // which field was the problem.
        throw invalidCredentials();
      }

      const user = await verifyCredentials(prisma, parsed.data);
      const tokens = await issueTokens(prisma, user);
      setAuthCookies(res, tokens);

      res.status(200).json({ id: user.id, email: user.email });
    } catch (err) {
      next(err);
    }
  });

  sessionRouter.post("/refresh", async (req, res, next) => {
    try {
      const presented = req.cookies?.[auth.REFRESH_TOKEN_COOKIE] as string | undefined;
      if (!presented) {
        throw invalidRefreshToken();
      }

      const { tokens } = await rotateRefreshToken(prisma, presented);
      setAuthCookies(res, tokens);

      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  sessionRouter.post("/logout", async (req, res, next) => {
    try {
      const presented = req.cookies?.[auth.REFRESH_TOKEN_COOKIE] as string | undefined;
      const endedUserId = presented ? await revokeRefreshToken(prisma, presented) : null;
      if (endedUserId && options.replies) {
        // Best-effort: signing out must never fail because conversation-service is slow or down.
        try {
          await options.replies.stopUserReplies(endedUserId);
        } catch (err) {
          options.onReplyStopError?.(err, endedUserId);
        }
      }
      clearAuthCookies(res);

      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  sessionRouter.get("/me", requireAuth, async (req, res, next) => {
    try {
      const user = await getUserById(prisma, req.userId as string);
      if (!user) {
        throw new HttpError(401, "UNAUTHENTICATED", "Not authenticated");
      }
      res.status(200).json({ id: user.id, email: user.email });
    } catch (err) {
      next(err);
    }
  });

  return sessionRouter;
}

export const sessionRouter: Router = createSessionRouter(defaultPrisma);
