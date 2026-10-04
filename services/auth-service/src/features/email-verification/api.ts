import { Router } from "express";
import rateLimit from "express-rate-limit";
import type { PrismaClient } from "../../generated/prisma-client/index.js";
import { auth } from "../../shared/contracts/index.js";
import { HttpError } from "../../shared/error-middleware.js";
import type { Mailer } from "../../shared/mailer.js";
import { requireAuth } from "../session/index.js";
import { sendVerificationEmail, verifyEmail } from "./model.js";

export interface EmailVerificationRouterOptions {
  mailer: Mailer;
  /** Resend requests per client and hour (default 5). */
  resendsPerHour?: number;
}

/**
 * `POST /auth/verify-email` `{ token }` -> 204: proves the address (no session needed, the token is
 * the proof). The next access token (sign-in or `POST /auth/refresh`) carries `email_verified: true`.
 *
 * `POST /auth/verify-email/resend` (signed in) -> 204: a new token replaces the pending one.
 */
export function createEmailVerificationRouter(prisma: PrismaClient, options: EmailVerificationRouterOptions): Router {
  const router: Router = Router();

  router.post("/verify-email", async (req, res, next) => {
    try {
      const parsed = auth.verifyEmailRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, "INVALID_VERIFICATION_TOKEN", "Invalid or expired verification token");
      }
      await verifyEmail(prisma, parsed.data.token);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  // On top of the app-wide limit: every resend writes a token and sends a message.
  const resendLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: options.resendsPerHour ?? 5,
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.post("/verify-email/resend", resendLimiter, requireAuth, async (req, res, next) => {
    try {
      const user = await prisma.user.findUnique({ where: { id: req.userId as string } });
      if (!user) {
        throw new HttpError(401, "UNAUTHENTICATED", "Not authenticated");
      }
      if (user.emailVerified) {
        throw new HttpError(409, "EMAIL_ALREADY_VERIFIED", "This email address is already verified");
      }
      await sendVerificationEmail(prisma, options.mailer, user);
      res.status(204).end();
    } catch (err) {
      next(err);
    }
  });

  return router;
}
