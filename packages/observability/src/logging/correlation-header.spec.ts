import { describe, expect, it } from "vitest";
import { CORRELATION_HEADER, getOrCreateCorrelationId } from "./correlation-header.js";

describe("getOrCreateCorrelationId", () => {
  it("AC-89: returns the existing header value when present (lower-cased key)", () => {
    const id = getOrCreateCorrelationId({ "x-correlation-id": "abc-123" });
    expect(id).toBe("abc-123");
  });

  it("AC-89: generates a UUID-shaped value when the header is absent", () => {
    const id = getOrCreateCorrelationId({});
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("AC-89: generates a value when the header is an empty string", () => {
    const id = getOrCreateCorrelationId({ "x-correlation-id": "" });
    expect(id.length).toBeGreaterThan(0);
    expect(id).not.toBe("");
  });

  it("AC-89: uses the first value when the header is provided as an array", () => {
    const id = getOrCreateCorrelationId({ "x-correlation-id": ["first", "second"] });
    expect(id).toBe("first");
  });

  it("AC-89: CORRELATION_HEADER matches STACK.md decision #8", () => {
    expect(CORRELATION_HEADER).toBe("X-Correlation-Id");
  });
});
