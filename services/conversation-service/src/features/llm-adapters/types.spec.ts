import { describe, expect, it } from "vitest";
import { ProviderError } from "./types.js";

describe("ProviderError", () => {
  it("carries the provider, retryable flag and status code", () => {
    const error = new ProviderError("openai", "rate limited", { retryable: true, statusCode: 429 });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ProviderError");
    expect(error.provider).toBe("openai");
    expect(error.message).toBe("rate limited");
    expect(error.retryable).toBe(true);
    expect(error.statusCode).toBe(429);
  });

  it("defaults to retryable without a status code", () => {
    const error = new ProviderError("anthropic", "network");
    expect(error.retryable).toBe(true);
    expect(error.statusCode).toBeUndefined();
  });

  it("keeps the original cause", () => {
    const cause = new Error("socket hang up");
    expect(new ProviderError("anthropic", "x", { retryable: false, cause }).cause).toBe(cause);
  });
});
