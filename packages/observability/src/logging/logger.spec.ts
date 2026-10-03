import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger.js";

function collectingStream(lines: string[]): Writable {
  return new Writable({
    write(chunk, _enc, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
}

describe("createLogger", () => {
  it("AC-88: produces valid JSON log lines with service, level, time, and msg", () => {
    const lines: string[] = [];
    const logger = createLogger("test-service", { destination: collectingStream(lines) });

    logger.info("hello world");

    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.service).toBe("test-service");
    expect(parsed.level).toBeTypeOf("number");
    expect(parsed.time).toBeTypeOf("number");
    expect(parsed.msg).toBe("hello world");
  });

  it("AC-90: redacts sensitive fields passed as a merging object", () => {
    const lines: string[] = [];
    const logger = createLogger("test-service", { destination: collectingStream(lines) });

    logger.info({ password: "hunter2", nested: { token: "abc" } }, "login attempt");

    const parsed = JSON.parse(lines[0]!);
    expect(parsed.password).toBe("[REDACTED]");
    expect(parsed.nested.token).toBe("[REDACTED]");
  });

  it("AC-88: respects an explicit level option", () => {
    const lines: string[] = [];
    const logger = createLogger("test-service", {
      destination: collectingStream(lines),
      level: "warn",
    });

    logger.info("should be suppressed");
    logger.warn("should appear");

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!).msg).toBe("should appear");
  });

  it("AC-88: child loggers created per request carry a correlationId field", () => {
    const lines: string[] = [];
    const logger = createLogger("test-service", { destination: collectingStream(lines) });
    const child = logger.child({ correlationId: "corr-1" });

    child.info("request handled");

    const parsed = JSON.parse(lines[0]!);
    expect(parsed.correlationId).toBe("corr-1");
    expect(parsed.service).toBe("test-service");
  });
});
