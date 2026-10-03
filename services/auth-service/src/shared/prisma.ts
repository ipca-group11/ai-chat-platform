/**
 * Prisma client singleton. Excluded from unit test coverage (see `vitest.config.ts`) —
 * exercised indirectly through integration-style feature tests that mock it instead.
 */
import { PrismaClient } from "../generated/prisma-client/index.js";

declare global {
  var __authServicePrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__authServicePrisma ??
  new PrismaClient({
    // Prisma's own query logging is left at defaults; request-scoped logging goes
    // through `pino`/`pino-http` in `shared/logger.ts` instead.
    log: ["error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__authServicePrisma = prisma;
}
