import pino, { type Logger } from "pino";
import type { DestinationStream } from "pino";
import { pinoRedactionOptions, redact } from "./redaction.js";

export interface CreateLoggerOptions {
  level?: string;
  /** Test-only: pass a captured stream instead of writing to stdout. */
  destination?: DestinationStream;
}

/**
 * Structured JSON logger factory (AC-88/AC-90). Every log line produced by the returned
 * logger includes `service`, `level`, `time`, and `msg` (pino's defaults plus a bound
 * `service` field); `correlationId` is added per-request by `correlationMiddleware`'s
 * child logger, not by the root logger itself.
 */
export function createLogger(serviceName: string, options: CreateLoggerOptions = {}): Logger {
  const pinoOptions = {
    name: serviceName,
    level: options.level ?? process.env.LOG_LEVEL ?? "info",
    base: { service: serviceName },
    redact: pinoRedactionOptions,
    // pino's path-based `redact` option only matches a finite set of enumerated depths
    // (see `redaction.ts`). This hook additionally runs every logged object through the
    // recursive `redact()` helper so secrets nested at arbitrary depth are still masked,
    // satisfying the "recursive, nesting-insensitive" requirement.
    hooks: {
      logMethod(inputArgs: unknown[], method: (...args: unknown[]) => unknown) {
        const transformed = inputArgs.map((arg) =>
          typeof arg === "object" && arg !== null ? redact(arg) : arg,
        );
        return method.apply(this, transformed);
      },
    },
  };

  return options.destination ? pino(pinoOptions, options.destination) : pino(pinoOptions);
}

export type { Logger };
