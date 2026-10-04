/**
 * Structured JSON logging (`pino`) with redaction of sensitive fields. Per
 * ARCHITECTURE.md §7 / this pod's PLAN.md B1: plaintext passwords, tokens and
 * `Authorization` headers must never be logged, at any nesting depth a log call might
 * pass them at (`logger.info({ password })`, `logger.info({ user: { password } })`,
 * `logger.info({ req: { body: { password } } })`, ...).
 *
 * Personal data follows the rule in docs/AICHAT-32/WORKLOG.md section 1: emails and IP
 * addresses are dropped from the line, message content is never logged, and a logged
 * request is only its id, method and path (no query string, no headers, no address).
 */
import pino, { type DestinationStream, type LoggerOptions } from "pino";
import { env } from "./env.js";
import { scrubUrl, serializeError } from "./pii-scrub.js";

export const REDACTED_CENSOR = "[REDACTED]";

/** Fields that are removed from the line entirely (no placeholder): addresses and message content. */
const DROPPED_KEYS: string[] = [
  "email",
  "ownerEmail",
  "authorEmail",
  "remoteAddress",
  "remotePort",
  "ip",
  "content",
  "reasoning",
  "extractedText",
  "filename",
];
const DROPPED_SET = new Set(DROPPED_KEYS);

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
  'req.headers["x-llm-api-key"]',
  'res.headers["set-cookie"]',
  'headers["set-cookie"]',
  '*.headers["set-cookie"]',
  ...DROPPED_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`, `*.*.*.${key}`]),
];

/** Serializers of every logger: a path is scrubbed, an error keeps its type and a scrubbed message. */
export const SERIALIZERS = {
  path: (path: unknown) => (typeof path === "string" ? scrubUrl(path) : path),
  err: serializeError,
};

/** The response pino-http logs: the status code only. The headers carry `Set-Cookie` with the session tokens. */
export function serializeResponse(res: { statusCode?: number }) {
  return { statusCode: res.statusCode };
}

/** The request pino-http logs: id, method and path. No query string, headers or remote address. */
export function serializeRequest(req: { id?: unknown; method?: string; originalUrl?: string; url?: string }) {
  return { id: req.id, method: req.method, url: scrubUrl(req.originalUrl ?? req.url ?? "") };
}

export function buildLoggerOptions(level: string): LoggerOptions {
  return {
    level,
    redact: {
      // Returning undefined removes the field; everything else becomes the placeholder.
      censor: (_value: unknown, path: string[]) => (DROPPED_SET.has(path[path.length - 1] ?? "") ? undefined : REDACTED_CENSOR),
      paths: REDACT_PATHS,
    },
    serializers: SERIALIZERS,
  };
}

export function createLogger(destination?: DestinationStream, level: string = env.LOG_LEVEL) {
  const options = buildLoggerOptions(level);
  return destination ? pino(options, destination) : pino(options);
}

export const logger = createLogger();

export type Logger = typeof logger;
