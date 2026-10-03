import pino, { type DestinationStream } from "pino";
import { LLM_API_KEY_HEADER } from "./contracts/http.js";
import { scrubUrl, serializeError } from "./pii-scrub.js";

/** Fields removed from the line entirely: addresses and message content. */
const DROPPED_KEYS = ["email", "ownerEmail", "authorEmail", "remoteAddress", "remotePort", "ip", "content", "reasoning", "extractedText", "filename"];
const DROPPED_SET = new Set(DROPPED_KEYS);

/**
 * Structured JSON logging (ARCHITECTURE.md §7). Redacts the per-request LLM API key
 * header, cookies, and any `apiKey` field so secrets never reach logs (ARCHITECTURE.md
 * §5/§6). Personal data follows docs/AICHAT-32/WORKLOG.md section 1: emails, addresses,
 * message content and attachment names are dropped, a path loses its query string, and an
 * error keeps its type and a scrubbed message. `destination` lets a test capture the lines.
 */
export function createLogger(level: string = "info", destination?: DestinationStream) {
  const options = {
    level,
    redact: {
      paths: [
        `req.headers["${LLM_API_KEY_HEADER.toLowerCase()}"]`,
        "req.headers.cookie",
        "req.headers.authorization",
        "*.apiKey",
        "*.password",
        ...DROPPED_KEYS.flatMap((key) => [key, `*.${key}`, `*.*.${key}`, `*.*.*.${key}`]),
      ],
      // Returning undefined removes the field; everything else becomes the placeholder.
      censor: (_value: unknown, path: string[]) => (DROPPED_SET.has(path[path.length - 1] ?? "") ? undefined : "[redacted]"),
    },
    serializers: {
      path: (path: unknown) => (typeof path === "string" ? scrubUrl(path) : path),
      err: serializeError,
    },
  };
  return destination ? pino(options, destination) : pino(options);
}

export type Logger = ReturnType<typeof createLogger>;
