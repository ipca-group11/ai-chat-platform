import { afterEach, describe, expect, it, vi } from "vitest";
import { CORRELATION_HEADER, generateCorrelationId } from "./correlation";

describe("CORRELATION_HEADER", () => {
  it("is the stable X-Correlation-Id header name (STACK.md decision #8)", () => {
    expect(CORRELATION_HEADER).toBe("X-Correlation-Id");
  });
});

describe("generateCorrelationId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses crypto.randomUUID when available", () => {
    vi.stubGlobal("crypto", { randomUUID: () => "11111111-1111-1111-1111-111111111111" });

    expect(generateCorrelationId()).toBe("11111111-1111-1111-1111-111111111111");
  });

  it("falls back to a generated id when crypto.randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {});

    expect(generateCorrelationId()).toMatch(/^corr-/);
  });
});
