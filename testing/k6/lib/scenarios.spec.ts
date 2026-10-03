import { describe, expect, it } from "vitest";
import { buildOptions, buildScenarios, buildThresholds, levelAt, readSettings } from "./scenarios.ts";

describe("readSettings", () => {
  it("defaults to the smoke scenario", () => {
    expect(readSettings({}).scenario).toBe("smoke");
  });

  it("rejects an unknown scenario", () => {
    expect(() => readSettings({ SCENARIO: "spike" })).toThrow(/Unknown SCENARIO/);
  });

  it("reads levels from a comma list and ignores bad entries", () => {
    expect(readSettings({ USER_LEVELS: "10, 20,x,-3,40" }).userLevels).toEqual([10, 20, 40]);
    expect(readSettings({ USER_LEVELS: "nope" }).userLevels).toEqual([100, 200, 400, 700, 1000]);
  });

  it("makes the soak duration configurable and 30 minutes by default", () => {
    expect(readSettings({}).soakDuration).toBe("30m");
    expect(readSettings({ SOAK_DURATION: "5m" }).soakDuration).toBe("5m");
  });
});

describe("scenarios", () => {
  it("seed registers one account per virtual user of the later runs", () => {
    expect(buildScenarios(readSettings({ SCENARIO: "seed", SEED_USERS: "120" }))).toMatchObject({
      seed: { executor: "shared-iterations", iterations: 120, exec: "seed" },
    });
  });

  it("smoke is one user and one iteration", () => {
    expect(buildScenarios(readSettings({ SCENARIO: "smoke" }))).toMatchObject({
      smoke: { executor: "per-vu-iterations", vus: 1, iterations: 1 },
    });
  });

  it("users_ramp climbs with ramping-vus, two stages per level", () => {
    const { users_ramp } = buildScenarios(readSettings({ SCENARIO: "users_ramp", USER_LEVELS: "10,20" })) as {
      users_ramp: { executor: string; stages: Array<{ duration: string; target: number }> };
    };
    expect(users_ramp.executor).toBe("ramping-vus");
    expect(users_ramp.stages.map((s) => s.target)).toEqual([10, 10, 20, 20]);
    expect(users_ramp.stages[0]?.duration).toBe("10s");
    expect(users_ramp.stages[1]?.duration).toBe("50s");
  });

  it("streams_ramp climbs with ramping-arrival-rate", () => {
    const scenarios = buildScenarios(readSettings({ SCENARIO: "streams_ramp", STREAM_LEVELS: "1,3" }));
    expect(scenarios).toMatchObject({ streams_ramp: { executor: "ramping-arrival-rate", maxVUs: 600 } });
  });

  it("soak holds a constant arrival rate", () => {
    expect(buildScenarios(readSettings({ SCENARIO: "soak", SOAK_RATE: "3", SOAK_DURATION: "5m" }))).toMatchObject({
      soak: { executor: "constant-arrival-rate", rate: 3, duration: "5m" },
    });
  });
});

describe("levelAt", () => {
  const settings = readSettings({ SCENARIO: "users_ramp", USER_LEVELS: "10,20,30", STAGE_SECONDS: "60" });

  it("maps the elapsed time to the level of the stage", () => {
    expect(levelAt(settings, 0)).toBe("10");
    expect(levelAt(settings, 59_999)).toBe("10");
    expect(levelAt(settings, 60_000)).toBe("20");
    expect(levelAt(settings, 10 * 60_000)).toBe("30");
  });

  it("has a single level outside the ramps", () => {
    expect(levelAt(readSettings({ SCENARIO: "soak" }), 123_456)).toBe("0");
  });
});

describe("thresholds (saturation)", () => {
  it("sets REST p95 < 1000 ms, TTFT p95 < 1500 ms, errors < 1 % and streams > 99 %", () => {
    const thresholds = buildThresholds(readSettings({ SCENARIO: "streams_ramp", STREAM_LEVELS: "2" }));
    expect(thresholds["http_req_duration{kind:rest}"]).toEqual(["p(95)<1000"]);
    expect(thresholds["http_req_failed{kind:rest}"]).toEqual(["rate<0.01"]);
    expect(thresholds["time_to_first_token"]).toEqual(["p(95)<1500"]);
    expect(thresholds["stream_success_rate"]).toEqual(["rate>0.99"]);
  });

  it("adds one threshold per level and never aborts the run", () => {
    const thresholds = buildThresholds(readSettings({ SCENARIO: "users_ramp", USER_LEVELS: "10,20" }));
    expect(Object.keys(thresholds)).toContain("http_req_duration{kind:rest,level:10}");
    expect(Object.keys(thresholds)).toContain("http_req_duration{kind:rest,level:20}");
    expect(JSON.stringify(thresholds)).not.toContain("abortOnFail");
  });

  it("buildOptions wires the scenario and the thresholds together", () => {
    const { options } = buildOptions({ SCENARIO: "soak" });
    expect(Object.keys(options.scenarios)).toEqual(["soak"]);
    expect(options.thresholds).toBeDefined();
  });
});
