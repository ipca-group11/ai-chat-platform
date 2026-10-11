import { describe, expect, it } from "vitest";
import { readSettings } from "../lib/scenarios.ts";
import { mixedScenarios, mixedThresholds } from "./mixed.ts";

describe("mixed scenario", () => {
  const settings = readSettings({ SCENARIO: "mixed" });

  it("defaults to 100 users and 30 streams per second at the same time", () => {
    const s = mixedScenarios(settings) as Record<string, Record<string, unknown>>;
    expect(s["mixed_users"]).toMatchObject({ executor: "constant-vus", vus: 100, exec: "browse" });
    expect(s["mixed_streams"]).toMatchObject({ executor: "constant-arrival-rate", rate: 30, exec: "stream" });
    expect(s["mixed_users"]?.["duration"]).toBe(s["mixed_streams"]?.["duration"]);
  });

  it("fails on REST p95 >= 1000 ms, TTFT p95 >= 1500 ms and failures >= 1 %", () => {
    expect(mixedThresholds(settings)).toEqual({
      "http_req_duration{kind:rest}": ["p(95)<1000"],
      "http_req_failed{kind:rest}": ["rate<0.01"],
      time_to_first_token: ["p(95)<1500"],
      stream_success_rate: ["rate>0.99"],
    });
  });

  it("reads overrides", () => {
    const o = readSettings({ SCENARIO: "mixed", MIXED_USERS: "10", MIXED_STREAMS: "5", MIXED_DURATION: "30s" });
    expect(o).toMatchObject({ mixedUsers: 10, mixedStreams: 5, mixedDuration: "30s" });
  });
});
