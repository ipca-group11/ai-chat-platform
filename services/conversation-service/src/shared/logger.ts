import pino, { type DestinationStream } from "pino";
import { LLM_API_KEY_HEADER } from "./contracts/http.js";

/**
 * Structured JSON logging (ARCHITECTURE.md §7). Redacts the per-request LLM API key
 * header, cookies, and any `apiKey` field so secrets never reach logs (ARCHITECTURE.md
 * §5/§6). `destination` lets a test capture the lines in memory.
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
      ],
      censor: "[redacted]",
    },
  };
  return destination ? pino(options, destination) : pino(options);
}

export type Logger = ReturnType<typeof createLogger>;
