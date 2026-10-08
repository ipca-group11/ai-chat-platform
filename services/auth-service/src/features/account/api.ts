import { Router } from "express";
import rateLimit from "express-rate-limit";
import bcrypt from "bcrypt";
import type { PrismaClient } from "../../generated/prisma-client/index.js";
import { auth } from "../../shared/contracts/index.js";
import { env } from "../../shared/env.js";
import type { ErasureClient } from "../../shared/erasure-client.js";
import { HttpError } from "../../shared/error-middleware.js";
import { rateLimitedHandler } from "../../shared/rate-limit.js";
import { clearAuthCookies, requireAuth } from "../session/index.js";
import { deleteAccount } from "./model.js";

export interface AccountRouterOptions {
  /** Undefined when INTERNAL_SERVICE_TOKEN or CONVERSATION_SERVICE_URL is not configured. */
  erasure?: ErasureClient;
  /** Failed or repeated deletions per client and hour. */
  deletionsPerHour?: number;
}

/** `DELETE /auth/me`: erases the signed-in user and everything they own. */
export function createAccountRouter(prisma: PrismaClient, options: AccountRouterOptions = {}): Router {
  const router: Router = Router();

  // On top of the app-wide limit: deleting an account is rare and expensive.
  const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: options.deletionsPerHour ?? 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitedHandler,
  });

  router.delete("/me", limiter, requireAuth, async (req, res, next) => {
    try {
      // CSRF: the cookies are SameSite=Lax (never sent on a cross-site DELETE), and a request that
      // names an origin other than the allowed ones is refused as well.
      const origin = req.get("origin");
      if (origin !== undefined && !env.CORS_ORIGINS.includes(origin)) {
        throw new HttpError(403, "FORBIDDEN_ORIGIN", "Request origin is not allowed");
      }

      if (!options.erasure) {
        // Never delete only the auth half of an account.
        throw new HttpError(503, "ACCOUNT_DELETION_UNAVAILABLE", "Account deletion is not available right now");
      }

      const { password } = auth.deleteAccountRequestSchema.parse(req.body);
      const userId = req.userId as string;
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (user) {
        // Asked again, so a stolen session cannot erase the account.
        if (!(await bcrypt.compare(password, user.passwordHash))) {
          throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid password");
        }
        await runDeletion(() => deleteAccount(prisma, options.erasure as ErasureClient, user));
      } else {
        // The row is already gone (a repeated request): finish the conversation side again, it is idempotent.
        await runDeletion(() => deleteAccount(prisma, options.erasure as ErasureClient, { id: userId, email: req.userEmail as string }));
      }

      clearAuthCookies(res);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}

async function runDeletion(run: () => Promise<void>): Promise<void> {
  try {
    await run();
  } catch {
    // The user still exists (or the retry will find nothing left): tell the client to try again.
    throw new HttpError(502, "ACCOUNT_DELETION_FAILED", "The account was not deleted. Try again");
  }
}
