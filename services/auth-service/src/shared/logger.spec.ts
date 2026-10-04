import { Writable } from "node:stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { buildLoggerOptions, createLogger, logger, serializeRequest, serializeResponse } from "./logger.js";

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

describe("logger masking of personal data (AICHAT-32)", () => {
  it("drops emails, addresses and message content from the line, at any depth", async () => {
    const { testLogger, lines } = makeCapturingLogger();
    testLogger.info(
      { email: "a@pii-canary.example.com", user: { ownerEmail: "b@pii-canary.example.com" }, req: { remoteAddress: "203.0.113.7", remotePort: 5000 }, content: "hello", a: { b: { reasoning: "why" } }, filename: "f.txt" },
      "x",
    );
    await flush();
    const entry = JSON.parse(lines[0] ?? "{}");
    expect(Object.keys(entry).sort()).toEqual(["a", "hostname", "level", "pid", "req", "time", "user", "msg"].sort());
    expect(JSON.stringify(entry)).not.toMatch(/pii-canary|203\.0\.113|hello|why|f\.txt/);
  });

  it("scrubs a path and an error before they are written", async () => {
    const { testLogger, lines } = makeCapturingLogger();
    testLogger.error({ path: "/x/a@pii-canary.example.com?q=1", err: new Error("bad a@pii-canary.example.com") }, "failed");
    await flush();
    const entry = JSON.parse(lines[0] ?? "{}");
    expect(entry.path).toBe("/x/[REDACTED]");
    expect(entry.err.message).toBe("bad [REDACTED]");
    testLogger.error({ path: 42 }, "not a string");
    await flush();
    expect(JSON.parse(lines[1] ?? "{}").path).toBe(42);
  });

  it("redacts Set-Cookie and the API key header wherever a response or request is logged", async () => {
    const { testLogger, lines } = makeCapturingLogger();
    testLogger.info({ res: { headers: { "set-cookie": ["access_token=abc"] } }, req: { headers: { "x-llm-api-key": "sk-secret" } } }, "x");
    await flush();
    const entry = JSON.parse(lines[0] ?? "{}");
    expect(entry.res.headers["set-cookie"]).toBe("[REDACTED]");
    expect(entry.req.headers["x-llm-api-key"]).toBe("[REDACTED]");
  });

  it("logs a response as its status code only", () => {
    expect(serializeResponse({ statusCode: 204 })).toEqual({ statusCode: 204 });
  });

  it("logs a request as id, method and path only", () => {
    expect(serializeRequest({ id: "c1", method: "GET", originalUrl: "/auth/me?email=a@pii-canary.example.com" })).toEqual({ id: "c1", method: "GET", url: "/auth/me" });
    expect(serializeRequest({ url: "/health" })).toEqual({ id: undefined, method: undefined, url: "/health" });
    expect(serializeRequest({}).url).toBe("");
  });
});

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
    testLogger.info({ userId: "user-1", correlationId: "abc-123" }, "ok");
    await flush();
    const entry = JSON.parse(lines[0] ?? "{}");
    expect(entry.userId).toBe("user-1");
    expect(entry.correlationId).toBe("abc-123");
  });

  it("createLogger() and the default `logger` export are usable without a destination", () => {
    expect(() => createLogger()).not.toThrow();
    expect(logger).toBeTruthy();
    expect(typeof logger.info).toBe("function");
  });
});
