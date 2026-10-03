import { describe, expect, it } from "vitest";
import { CORRELATION_HEADER, getOrCreateCorrelationId } from "./correlation-id";

describe("getOrCreateCorrelationId", () => {
  it("AC-8: returns the existing header value from a Headers-like object", () => {
    const headers = new Map([[CORRELATION_HEADER, "abc-123"]]);
    const reader = { get: (name: string) => headers.get(name) ?? null };
    expect(getOrCreateCorrelationId(reader)).toBe("abc-123");
  });

  it("AC-8: generates a UUID when the Headers-like object has no value", () => {
    const reader = { get: () => null };
    const id = getOrCreateCorrelationId(reader);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("AC-8: returns the existing header value from a plain record", () => {
    expect(
      getOrCreateCorrelationId({ [CORRELATION_HEADER]: "req-1" }),
    ).toBe("req-1");
  });

  it("AC-8: falls back to the lowercase header key (Node IncomingMessage convention)", () => {
    expect(
      getOrCreateCorrelationId({ "x-correlation-id": "req-2" }),
    ).toBe("req-2");
  });

  it("AC-8: generates a UUID when a plain record has no value", () => {
    const id = getOrCreateCorrelationId({});
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("AC-8: handles an array header value by taking the first entry", () => {
    expect(
      getOrCreateCorrelationId({ [CORRELATION_HEADER]: ["first", "second"] }),
    ).toBe("first");
  });
});
