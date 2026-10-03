import { PrismaClient } from "../generated/prisma-client/index.js";

/** Singleton Prisma client for the service process. Excluded from coverage/tests. */
export const prisma = new PrismaClient();

export type { PrismaClient } from "../generated/prisma-client/index.js";
