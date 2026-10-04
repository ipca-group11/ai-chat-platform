import { describe, expect, it } from "vitest";
import { STABLE_CSS } from "./stable-css.js";

describe("stable CSS for screenshots", () => {
  it("promotes the round elements to their own layer and changes nothing else", () => {
    expect(STABLE_CSS).toBe(".rounded-full { transform: translateZ(0); }");
  });
});
