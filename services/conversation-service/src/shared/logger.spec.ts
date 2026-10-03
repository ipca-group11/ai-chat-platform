import { Writable } from "node:stream";
import type * as PinoModule from "pino";
import type { LoggerOptions } from "pino";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Capture the options createLogger hands to pino, then run the real pino with the same
// options against an in-memory stream, so the redaction is checked on real output.
const captured = vi.hoisted(() => ({ options: undefined as LoggerOptions | undefined }));

vi.mock("pino", async () => {
  const actual = await vi.importActual<typeof PinoModule>("pino");
  const wrapped = ((options: LoggerOptions) => {
    captured.options = options;
    return actual.default(options);
  }) as unknown as typeof actual.default;
  return { ...actual, default: wrapped };
});

const { createLogger } = await import("./logger.js");
const realPino = (await vi.importActual<typeof PinoModule>("pino")).default;

function logThroughProductionOptions(payload: Record<string, unknown>) {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  realPino({ ...captured.options }, stream).info(payload);
  return JSON.parse(lines[0] ?? "{}") as { req: { url: string; headers: Record<string, string> }; user: Record<string, string> };
}

describe("createLogger", () => {
  beforeEach(() => {
    captured.options = undefined;
  });

  it("defaults to the info level", () => {
    expect(createLogger().level).toBe("info");
    expect(captured.options?.level).toBe("info");
  });

  it("uses the level it is given", () => {
    expect(createLogger("debug").level).toBe("debug");
  });

  it("redacts the LLM key header, cookies, authorization and secret fields", () => {
    createLogger();
    const entry = logThroughProductionOptions({
      req: {
        url: "/chats",
        headers: { "x-llm-api-key": "sk-secret", cookie: "access_token=abc", authorization: "Bearer t" },
      },
      user: { apiKey: "sk-secret", password: "hunter22", name: "ana" },
    });

    expect(entry.req.headers["x-llm-api-key"]).toBe("[redacted]");
    expect(entry.req.headers.cookie).toBe("[redacted]");
    expect(entry.req.headers.authorization).toBe("[redacted]");
    expect(entry.user.apiKey).toBe("[redacted]");
    expect(entry.user.password).toBe("[redacted]");
  });

  it("leaves non-secret fields readable", () => {
    createLogger();
    const entry = logThroughProductionOptions({ req: { url: "/chats", headers: {} }, user: { name: "ana" } });
    expect(entry.req.url).toBe("/chats");
    expect(entry.user.name).toBe("ana");
  });

  it("drops emails, addresses, message content and file names from the line", () => {
    createLogger();
    const entry = logThroughProductionOptions({
      ownerEmail: "a@pii-canary.example.com",
      chat: { authorEmail: "b@pii-canary.example.com", content: "hello", filename: "f.txt" },
      req: { remoteAddress: "203.0.113.7" },
      chatId: "c1",
    }) as unknown as Record<string, unknown>;
    expect(entry.chatId).toBe("c1");
    expect(JSON.stringify(entry)).not.toMatch(/pii-canary|203\.0\.113|hello|f\.txt/);
  });

  it("scrubs a path and writes an error as its type and a scrubbed message", () => {
    createLogger();
    const entry = logThroughProductionOptions({
      path: "/x/a@pii-canary.example.com?q=1",
      err: Object.assign(new Error("bad a@pii-canary.example.com"), { filename: "f.txt" }),
    }) as unknown as { path: string; err: Record<string, string> };
    expect(entry.path).toBe("/x/[REDACTED]");
    expect(entry.err.message).toBe("bad [REDACTED]");
    expect(entry.err.filename).toBeUndefined();
    expect(logThroughProductionOptions({ path: 42 })).toMatchObject({ path: 42 });
  });
});
