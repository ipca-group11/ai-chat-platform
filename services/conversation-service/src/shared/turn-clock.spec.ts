import { describe, expect, it } from "vitest";
import { createTurnClock } from "./turn-clock.js";

describe("createTurnClock (AICHAT-191)", () => {
  it("follows the wall clock when it moves forward", () => {
    let now = 1_000;
    const tick = createTurnClock(() => now);
    expect(tick().getTime()).toBe(1_000);
    now = 5_000;
    expect(tick().getTime()).toBe(5_000);
  });

  it("never repeats a value: calls in the same millisecond are 1 ms apart", () => {
    const tick = createTurnClock(() => 1_000);
    expect([tick(), tick(), tick()].map((d) => d.getTime())).toEqual([1_000, 1_001, 1_002]);
  });

  it("never goes back when the wall clock does", () => {
    let now = 1_000;
    const tick = createTurnClock(() => now);
    tick();
    now = 400;
    expect(tick().getTime()).toBe(1_001);
  });
});
