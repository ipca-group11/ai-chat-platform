/**
 * Password hashing with bcrypt. The real cost (12) applies everywhere except the test
 * environment, where the minimum cost (4) keeps the suites fast (AICHAT-252). The cost is
 * not an env variable on purpose: production can never be configured with a weak one.
 */
import bcrypt from "bcrypt";
import { env } from "./env.js";

export const PRODUCTION_BCRYPT_COST = 12;
export const TEST_BCRYPT_COST = 4;

export function bcryptCost(nodeEnv: string = env.NODE_ENV): number {
  return nodeEnv === "test" ? TEST_BCRYPT_COST : PRODUCTION_BCRYPT_COST;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, bcryptCost());
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

let dummyHash: Promise<string> | undefined;

/**
 * Compares the password against a throwaway hash made at the same cost as real ones, so an
 * unknown email takes as long as a wrong password (defense against email enumeration by timing).
 * Always resolves to false.
 */
export async function burnPasswordCheck(password: string): Promise<false> {
  dummyHash ??= bcrypt.hash("timing-equaliser-not-a-credential", bcryptCost());
  await bcrypt.compare(password, await dummyHash);
  return false;
}
