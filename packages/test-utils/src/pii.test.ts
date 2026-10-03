import * as detector from "@platform/pii-detector";
import { describe, expect, it } from "vitest";
import * as viaTestUtils from "./pii";

describe("@platform/test-utils/pii", () => {
  it("re-exports the detector", () => {
    expect(viaTestUtils.findPii).toBe(detector.findPii);
    expect(viaTestUtils.createLogCapture).toBe(detector.createLogCapture);
    expect(viaTestUtils.findPii("mail ana@pii-canary.example.com")).toHaveLength(1);
  });
});
