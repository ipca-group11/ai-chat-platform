import { Router } from "express";
import { auth } from "../../shared/contracts/index.js";
import { HttpError } from "../../shared/error-middleware.js";
import type { PrismaClient } from "../../generated/prisma-client/index.js";
import { prisma as defaultPrisma } from "../../shared/prisma.js";
import { createMailer, type Mailer } from "../../shared/mailer.js";
import { env } from "../../shared/env.js";
import { logger } from "../../shared/logger.js";
import { sendVerificationEmail } from "../email-verification/index.js";
import { registerUser } from "./model.js";

/** Builds the register router around the given Prisma client and mailer (injectable for tests). */
export function createRegisterRouter(prisma: PrismaClient, mailer: Mailer = createMailer(env.EMAIL_DELIVERY, logger)): Router {
  const registerRouter: Router = Router();

  registerRouter.post("/register", async (req, res, next) => {
    try {
      const parsed = auth.registerRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
        throw new HttpError(400, "VALIDATION_ERROR", "Invalid registration details", fieldErrors);
      }

      const user = await registerUser(prisma, parsed.data);
      // The account exists either way; when delivery fails the user asks for a new token (resend).
      try {
        await sendVerificationEmail(prisma, mailer, user);
      } catch (err) {
        (req.log ?? logger).warn({ err, userId: user.id }, "email verification not sent");
      }

      res.status(201).json({ id: user.id, email: user.email });
    } catch (err) {
      next(err);
    }
  });

  return registerRouter;
}

export const registerRouter: Router = createRegisterRouter(defaultPrisma);
