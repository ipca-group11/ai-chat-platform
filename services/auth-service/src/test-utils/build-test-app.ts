import type { Express } from "express";
import type { PrismaClient } from "../generated/prisma-client/index.js";
import { createApp } from "../main.js";
import type { Logger } from "../shared/logger.js";
import { fakePrisma } from "./fake-prisma.js";

/** The real `createApp` (helmet, cors, rate limit, correlation id, routers, error
 * middleware) backed by the in-memory Prisma fake. No database, no network. */
export function buildTestApp(
  prisma: PrismaClient = fakePrisma(),
  options: { logger?: Logger } = {},
): { app: Express; prisma: ReturnType<typeof fakePrisma> } {
  return { app: createApp({ prisma, logger: options.logger }), prisma: prisma as ReturnType<typeof fakePrisma> };
}
