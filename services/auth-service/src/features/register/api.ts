import { Router } from "express";
import { auth } from "../../shared/contracts/index.js";
import { HttpError, toFieldErrors } from "../../shared/error-middleware.js";
import type { PrismaClient } from "../../generated/prisma-client/index.js";
import { prisma as defaultPrisma } from "../../shared/prisma.js";
import { registerUser } from "./model.js";

/** Builds the register router around the given Prisma client (injectable for tests). */
export function createRegisterRouter(prisma: PrismaClient): Router {
  const registerRouter: Router = Router();

  registerRouter.post("/register", async (req, res, next) => {
    try {
      const parsed = auth.registerRequestSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, "VALIDATION_ERROR", "Invalid registration details", toFieldErrors(parsed.error));
      }

      const user = await registerUser(prisma, parsed.data);

      res.status(201).json({ id: user.id, email: user.email });
    } catch (err) {
      next(err);
    }
  });

  return registerRouter;
}

export const registerRouter: Router = createRegisterRouter(defaultPrisma);
