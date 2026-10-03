import { Router } from "express";
import { auth } from "../../shared/contracts/index.js";
import { HttpError } from "../../shared/error-middleware.js";
import { prisma } from "../../shared/prisma.js";
import { registerUser } from "./model.js";

export const registerRouter: Router = Router();

registerRouter.post("/register", async (req, res, next) => {
  try {
    const parsed = auth.registerRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors as Record<string, string[]>;
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid registration details", fieldErrors);
    }

    const user = await registerUser(prisma, parsed.data);

    res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    next(err);
  }
});
