/**
 * Redaction configuration shared by every service's structured logs and error responses
 * (`STACK.md` decision #8 references correlation IDs; this file covers the companion
 * "never log secrets" requirement from `docs/ARCHITECTURE.md` §7 / AC-90).
 *
 * `SENSITIVE_KEYS` is the case-insensitive list of object keys that must never appear in
 * plaintext in a log line or a serialized error response, no matter how deeply nested.
 */
export const SENSITIVE_KEYS = [
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "apiKey",
  "authorization",
  "cookie",
] as const;

export type SensitiveKey = (typeof SENSITIVE_KEYS)[number];

const REDACTED = "[REDACTED]";

const SENSITIVE_KEYS_LOWER = new Set(SENSITIVE_KEYS.map((key) => key.toLowerCase()));

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS_LOWER.has(key.toLowerCase());
}

/**
 * `pino` redaction paths for `SENSITIVE_KEYS`, matching the key at any nesting depth via
 * pino's wildcard path syntax. Spread into the `redact` option of `createLogger`, or reuse
 * directly if a service builds its own pino instance.
 */
export function pinoRedactionPaths(): string[] {
  const paths: string[] = [];
  for (const key of SENSITIVE_KEYS) {
    // Top-level, one level deep, and arbitrarily deep (pino redact does not support a
    // single "match anywhere" wildcard, so common depths are enumerated explicitly and
    // `redact()` below is used for genuinely dynamic/deep objects such as error bodies).
    paths.push(key, `*.${key}`, `*.*.${key}`, `*.*.*.${key}`);
  }
  return paths;
}

export const pinoRedactionOptions = {
  paths: pinoRedactionPaths(),
  censor: REDACTED,
};

/**
 * Recursively walks an arbitrary object/array and replaces the value of any key matching
 * `SENSITIVE_KEYS` (case-insensitive) with `[REDACTED]`, at any nesting depth. Returns a
 * new value; does not mutate the input. Intended for use when building error-response
 * bodies (where the offending payload might otherwise be echoed back) rather than for the
 * main log stream, which pino redacts itself via `pinoRedactionOptions`.
 */
export function redact<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (value === null || typeof value !== "object") {
    return value;
  }

  if (seen.has(value as object)) {
    return value;
  }
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, seen)) as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = REDACTED;
    } else {
      result[key] = redact(val, seen);
    }
  }
  return result as T;
}
