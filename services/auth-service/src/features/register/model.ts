/**
 * Registration business logic (PLAN.md B2). Validates against the shared password
 * policy (`shared/contracts/auth.ts`, mirroring `packages/shared-types`), rejects a
 * duplicate email (case-insensitive — the shared schema lower-cases email on parse, and
 * every lookup/insert goes through that same normalization) with a 409, and hashes the
 * password with bcrypt before persisting. The plaintext password is never logged or
 * returned.
 */
import type { PrismaClient } from "../../generated/prisma-client/index.js";
import type { auth } from "../../shared/contracts/index.js";
import { HttpError } from "../../shared/error-middleware.js";
import { hashPassword } from "../../shared/password.js";

export interface RegisteredUser {
  id: string;
  email: string;
  createdAt: Date;
}

export async function registerUser(
  prisma: PrismaClient,
  input: auth.RegisterRequest,
): Promise<RegisteredUser> {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new HttpError(
      409,
      "EMAIL_TAKEN",
      "An account with this email already exists",
      { email: ["An account with this email already exists"] },
    );
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: { email: input.email, passwordHash },
  });

  return { id: user.id, email: user.email, createdAt: user.createdAt };
}
