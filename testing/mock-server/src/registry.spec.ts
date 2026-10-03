import { describe, expect, it } from "vitest";
import { createScenarioRegistry } from "./registry.js";

describe("createScenarioRegistry", () => {
  it("starts empty", () => {
    expect(createScenarioRegistry().list()).toEqual([]);
  });

  it("lists registered scenarios sorted by mock and name", () => {
    const registry = createScenarioRegistry();
    registry.register(
      { mock: "openai", name: "ok", description: "Normal answer" },
      { mock: "anthropic", name: "slow", description: "Slow answer" },
      { mock: "anthropic", name: "ok", description: "Normal answer" },
    );
    expect(registry.list().map((s) => `${s.mock}/${s.name}`)).toEqual([
      "anthropic/ok",
      "anthropic/slow",
      "openai/ok",
    ]);
    expect(registry.has("openai", "ok")).toBe(true);
    expect(registry.has("openai", "slow")).toBe(false);
  });

  it("refuses the same scenario twice", () => {
    const registry = createScenarioRegistry();
    registry.register({ mock: "auth", name: "slow", description: "x" });
    expect(() => registry.register({ mock: "auth", name: "slow", description: "y" })).toThrow(/already registered/);
  });
});
