import type { Express } from "express";
import type { PrismaClient } from "../generated/prisma-client/index.js";
import { createApp } from "../main.js";
import type { ErasureClient } from "../shared/erasure-client.js";
import type { Logger } from "../shared/logger.js";
import { fakePrisma } from "./fake-prisma.js";
import { MemoryMailer } from "./memory-mailer.js";

/** The real `createApp` (helmet, cors, rate limit, correlation id, routers, error
 * middleware) backed by the in-memory Prisma fake and a mailer that keeps the messages in
 * memory. No database, no network. */
export function buildTestApp(
  prisma: PrismaClient = fakePrisma(),
  options: {
    logger?: Logger;
    erasure?: ErasureClient;
    deletionsPerHour?: number;
    requestsPerWindow?: number;
    trustProxy?: number | string;
    resendsPerHour?: number;
  } = {},
): { app: Express; prisma: ReturnType<typeof fakePrisma>; mailer: MemoryMailer } {
  const mailer = new MemoryMailer();
  return { app: createApp({ prisma, mailer, ...options }), prisma: prisma as ReturnType<typeof fakePrisma>, mailer };
}
