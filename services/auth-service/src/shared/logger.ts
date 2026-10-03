/**
 * Structured JSON logging (`pino`) with redaction of sensitive fields. Per
 * ARCHITECTURE.md §7 / this pod's PLAN.md B1: plaintext passwords, tokens and
 * `Authorization` headers must never be logged, at any nesting depth a log call might
 * pass them at (`logger.info({ password })`, `logger.info({ user: { password } })`,
 * `logger.info({ req: { body: { password } } })`, ...).
 */
import pino, { type DestinationStream, type LoggerOptions } from "pino";
import { env } from "./env.js";

export const REDACTED_CENSOR = "[REDACTED]";

/** Field paths redacted at any nesting depth pino-redact supports. */
export const REDACT_PATHS: string[] = [
  "password",
  "*.password",
  "*.*.password",
  "*.*.*.password",
  "newPassword",
  "*.newPassword",
  "passwordHash",
  "*.passwordHash",
  "token",
  "*.token",
  "*.*.token",
  "accessToken",
  "*.accessToken",
  "refreshToken",
  "*.refreshToken",
  "authorization",
  "*.authorization",
  "req.headers.authorization",
  "headers.authorization",
  "cookie",
  "*.cookie",
  "req.headers.cookie",
  "headers.cookie",
];

export function buildLoggerOptions(level: string): LoggerOptions {
  return {
    level,
    redact: { censor: REDACTED_CENSOR, paths: REDACT_PATHS },
  };
}

export function createLogger(destination?: DestinationStream, level: string = env.LOG_LEVEL) {
  const options = buildLoggerOptions(level);
  return destination ? pino(options, destination) : pino(options);
}

export const logger = createLogger();

export type Logger = typeof logger;
