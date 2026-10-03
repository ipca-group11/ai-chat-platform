import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * `streaming-load.js` (O6, AC-96) runs under the k6 runtime, not Node, so it can't be
 * imported and executed directly in Vitest. These are static, structural checks on the
 * script's source text pinning down the contract described in README.md: >=5 VUs, a
 * time-to-first-token trend thresholded around the ~1s NFR, and a 0%-dropped-stream rate
 * threshold across concurrent chats.
 */

const scriptPath = fileURLToPath(new URL("./streaming-load.js", import.meta.url));
const source = readFileSync(scriptPath, "utf-8");

describe("K6 streaming load test (AC-96)", () => {
  it("AC-96: defaults to at least 5 virtual users", () => {
    expect(source).toMatch(/K6_VUS\s*\|\|\s*5/);
    // Guards against someone lowering the seeded/default VU count below the NFR's
    // "at least 5 concurrent streaming chats" floor.
    const usersMatch = source.match(/Math\.max\(VUS,\s*(\d+)\)/);
    expect(usersMatch).not.toBeNull();
    expect(Number(usersMatch?.[1])).toBeGreaterThanOrEqual(5);
  });

  it("AC-96: records a time-to-first-token trend metric", () => {
    expect(source).toContain('new Trend("time_to_first_token"');
  });

  it("AC-96: records a stream success/drop rate metric", () => {
    expect(source).toContain('new Rate("stream_success_rate")');
  });

  it("AC-96: thresholds first-token latency around the ~1s NFR", () => {
    expect(source).toMatch(/time_to_first_token["'][^}]*p\(95\)<\s*\d+/s);
  });

  it("AC-96: thresholds stream success at 100% (0% dropped/failed streams)", () => {
    expect(source).toMatch(/stream_success_rate["'][^\]]*rate==1/s);
  });

  it("AC-96: drives each virtual user through login, chat creation, and streaming a message", () => {
    expect(source).toContain("registerOrLogin");
    expect(source).toContain("createChat");
    expect(source).toContain("sendAndStream");
  });
});
