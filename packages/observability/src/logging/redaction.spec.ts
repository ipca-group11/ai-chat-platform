import { describe, expect, it } from "vitest";
import { pinoRedactionOptions, pinoRedactionPaths, redact, SENSITIVE_KEYS } from "./redaction.js";

describe("redaction", () => {
  it("AC-90: redacts a top-level password field", () => {
    const result = redact({ email: "a@b.com", password: "hunter2" });
    expect(result).toEqual({ email: "a@b.com", password: "[REDACTED]" });
  });

  it("AC-90: redacts token/apiKey even when nested inside a larger object", () => {
    const input = {
      user: { id: "1", credentials: { token: "abc123", apiKey: "sk-live-xyz" } },
    };

    const result = redact(input);

    expect(result).toEqual({
      user: { id: "1", credentials: { token: "[REDACTED]", apiKey: "[REDACTED]" } },
    });
  });

  it("AC-90: redacts sensitive keys inside arrays of objects", () => {
    const input = { items: [{ accessToken: "t1" }, { name: "ok" }] };

    const result = redact(input);

    expect(result).toEqual({ items: [{ accessToken: "[REDACTED]" }, { name: "ok" }] });
  });

  it("AC-90: matches keys case-insensitively", () => {
    const result = redact({ Password: "secret", REFRESHTOKEN: "rt" });
    expect(result).toEqual({ Password: "[REDACTED]", REFRESHTOKEN: "[REDACTED]" });
  });

  it("AC-90: does not mutate the input object", () => {
    const input = { password: "secret" };
    const result = redact(input);
    expect(input.password).toBe("secret");
    expect(result).not.toBe(input);
  });

  it("AC-90: passes through primitives and null unchanged", () => {
    expect(redact(null)).toBeNull();
    expect(redact(42)).toBe(42);
    expect(redact("hello")).toBe("hello");
  });

  it("AC-90: handles circular references without throwing", () => {
    const input: Record<string, unknown> = { password: "secret" };
    input.self = input;

    expect(() => redact(input)).not.toThrow();
  });

  it("AC-90: pinoRedactionPaths covers every sensitive key", () => {
    const paths = pinoRedactionPaths();
    for (const key of SENSITIVE_KEYS) {
      expect(paths).toContain(key);
    }
  });

  it("AC-90: pinoRedactionOptions exposes a pino-compatible options fragment", () => {
    expect(pinoRedactionOptions.censor).toBe("[REDACTED]");
    expect(pinoRedactionOptions.paths.length).toBeGreaterThan(0);
  });
});
