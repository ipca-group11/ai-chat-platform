import { describe, expect, it } from "vitest";
import { createRng, seedToNumber } from "./prng.js";

describe("createRng", () => {
  it("gives the same sequence for the same seed", () => {
    const a = createRng("42");
    const b = createRng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it("gives different sequences for different seeds", () => {
    expect(createRng("1").next()).not.toBe(createRng("2").next());
  });

  it("hashes text seeds to a stable number", () => {
    expect(seedToNumber("hello")).toBe(seedToNumber("hello"));
    expect(seedToNumber("hello")).not.toBe(seedToNumber("world"));
    expect(seedToNumber("7")).toBe(7);
  });

  it("starts the sequence again after reset()", () => {
    const rng = createRng("9");
    const first = [rng.next(), rng.next()];
    rng.reset();
    expect([rng.next(), rng.next()]).toEqual(first);
  });

  it("int() stays inside the range, bounds included", () => {
    const rng = createRng("3");
    const values = Array.from({ length: 500 }, () => rng.int(2, 4));
    expect(Math.min(...values)).toBe(2);
    expect(Math.max(...values)).toBe(4);
  });

  it("pick() returns an item of the list and refuses an empty one", () => {
    const rng = createRng("5");
    expect(["a", "b", "c"]).toContain(rng.pick(["a", "b", "c"]));
    expect(() => rng.pick([])).toThrow(/non-empty/);
  });

  it("chance() respects 0 and 1", () => {
    const rng = createRng("5");
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(1)).toBe(true);
  });
});
