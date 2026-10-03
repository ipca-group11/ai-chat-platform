import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { buildLoggerOptions, createLogger, logger } from "./logger.js";

// Builds a logger from the app's real redact configuration (`buildLoggerOptions`), but
// with an explicit "info" level (independent of `LOG_LEVEL`, which tests set to
// "silent") and a capturing in-memory stream instead of stdout.
function makeCapturingLogger() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const testLogger = pino(buildLoggerOptions("info"), stream);
  return { testLogger, lines };
}

/** pino writes to the stream asynchronously; give it a moment to flush before asserting. */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe("logger redaction (AC-33: plaintext password never logged)", () => {
  it("redacts a top-level password field", async () => {
    const { testLogger, lines } = makeCapturingLogger();
    testLogger.info({ email: "a@b.com", password: "super-secret" }, "register attempt");
    await flush();
    const entry = JSON.parse(lines[0] ?? "{}");
    expect(entry.password).toBe("[REDACTED]");
    expect(JSON.stringify(entry)).not.toContain("super-secret");
  });

  it("redacts a nested password field (e.g. req.body.password)", async () => {
    const { testLogger, lines } = makeCapturingLogger();
    testLogger.info({ req: { body: { password: "super-secret" } } }, "req");
    await flush();
    const entry = JSON.parse(lines[0] ?? "{}");
    expect(entry.req.body.password).toBe("[REDACTED]");
    expect(JSON.stringify(entry)).not.toContain("super-secret");
  });

  it("redacts a token field", async () => {
    const { testLogger, lines } = makeCapturingLogger();
    testLogger.info({ token: "opaque-refresh-token-value" }, "issued");
    await flush();
    const entry = JSON.parse(lines[0] ?? "{}");
    expect(entry.token).toBe("[REDACTED]");
  });

  it("redacts a refreshToken field", async () => {
    const { testLogger, lines } = makeCapturingLogger();
    testLogger.info({ refreshToken: "opaque-refresh-token-value" }, "issued");
    await flush();
    const entry = JSON.parse(lines[0] ?? "{}");
    expect(entry.refreshToken).toBe("[REDACTED]");
  });

  it("redacts the Authorization header", async () => {
    const { testLogger, lines } = makeCapturingLogger();
    testLogger.info({ req: { headers: { authorization: "Bearer secret" } } }, "req");
    await flush();
    const entry = JSON.parse(lines[0] ?? "{}");
    expect(entry.req.headers.authorization).toBe("[REDACTED]");
  });

  it("does not redact unrelated fields", async () => {
    const { testLogger, lines } = makeCapturingLogger();
    testLogger.info({ email: "a@b.com", correlationId: "abc-123" }, "ok");
    await flush();
    const entry = JSON.parse(lines[0] ?? "{}");
    expect(entry.email).toBe("a@b.com");
    expect(entry.correlationId).toBe("abc-123");
  });

  it("createLogger() and the default `logger` export are usable without a destination", () => {
    expect(() => createLogger()).not.toThrow();
    expect(logger).toBeTruthy();
    expect(typeof logger.info).toBe("function");
  });
});
