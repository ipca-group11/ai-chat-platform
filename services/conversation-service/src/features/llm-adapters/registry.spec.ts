import { describe, expect, it } from "vitest";
import { createProviderRegistry } from "./registry.js";

describe("createProviderRegistry", () => {
  it("AC-64: selects the adapter implementation based on the configured provider", () => {
    const registry = createProviderRegistry();
    expect(registry.get("openai").id).toBe("openai");
    expect(registry.get("anthropic").id).toBe("anthropic");
  });

  it("throws a clear error for an unregistered provider id", () => {
    const registry = createProviderRegistry();
    expect(() => registry.get("unknown" as never)).toThrow(/No LLM provider adapter registered/);
  });

  it("AC-65: every registered adapter implements the same LlmProvider surface", () => {
    const registry = createProviderRegistry();
    for (const id of ["openai", "anthropic"] as const) {
      const adapter = registry.get(id);
      expect(typeof adapter.sendMessage).toBe("function");
      expect(typeof adapter.supportsVision).toBe("function");
    }
  });
});
