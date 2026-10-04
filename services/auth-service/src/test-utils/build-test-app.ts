import type { Express } from "express";
import type { PrismaClient } from "../generated/prisma-client/index.js";
import { createApp } from "../main.js";
import type { ErasureClient } from "../shared/erasure-client.js";
import type { Logger } from "../shared/logger.js";
import { fakePrisma } from "./fake-prisma.js";

/** The real `createApp` (helmet, cors, rate limit, correlation id, routers, error
 * middleware) backed by the in-memory Prisma fake. No database, no network. */
export function buildTestApp(
  prisma: PrismaClient = fakePrisma(),
  options: { logger?: Logger; erasure?: ErasureClient; deletionsPerHour?: number } = {},
): { app: Express; prisma: ReturnType<typeof fakePrisma> } {
  return { app: createApp({ prisma, logger: options.logger, erasure: options.erasure, deletionsPerHour: options.deletionsPerHour }), prisma: prisma as ReturnType<typeof fakePrisma> };
}
