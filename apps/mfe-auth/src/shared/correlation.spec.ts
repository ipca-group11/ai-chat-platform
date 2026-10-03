import { afterEach, describe, expect, it, vi } from "vitest";
import { CORRELATION_HEADER, generateCorrelationId } from "./correlation";

describe("correlation id", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses the header name of the platform contract", () => {
    expect(CORRELATION_HEADER).toBe("X-Correlation-Id");
  });

  it("returns a UUID from the Web Crypto API when available", () => {
    expect(generateCorrelationId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it("returns a different id each call", () => {
    expect(generateCorrelationId()).not.toBe(generateCorrelationId());
  });

  it("falls back to a 'corr-' id when crypto.randomUUID is missing", () => {
    vi.stubGlobal("crypto", {});
    expect(generateCorrelationId()).toMatch(/^corr-\d+-[0-9a-f]+$/);
  });

  it("falls back when crypto itself is undefined", () => {
    vi.stubGlobal("crypto", undefined);
    expect(generateCorrelationId()).toMatch(/^corr-/);
  });
});
