import { mixedScenarios, mixedThresholds, MIXED_DURATION, MIXED_STREAMS_PER_SECOND, MIXED_USERS } from "../scenarios/mixed.ts";
/**
 * Scenario definitions of the load test (AICHAT-24). Pure TypeScript with no k6 imports, so
 * Vitest can check them; `load.ts` hands the result to k6 as `options`.
 *
 * Every ramp is a staircase: each level ramps up for RAMP_SECONDS and then holds until
 * STAGE_SECONDS are over. Requests carry a `level` tag, so k6 reports one p95 per level and
 * the first level whose threshold fails is the saturation point.
 */

export type ScenarioName = "seed" | "smoke" | "users_ramp" | "streams_ramp" | "soak" | "mixed";
export const SCENARIO_NAMES: readonly ScenarioName[] = ["seed", "smoke", "users_ramp", "streams_ramp", "soak", "mixed"];

export type Env = Record<string, string | undefined>;

export interface Settings {
  scenario: ScenarioName;
  /** Browsing users per level (users_ramp), as virtual users. */
  userLevels: number[];
  /** New streams per second per level (streams_ramp). */
  streamLevels: number[];
  stageSeconds: number;
  rampSeconds: number;
  /** Arrival rate of the soak run, new streams per second. */
  soakRate: number;
  soakDuration: string;
  /** Mixed scenario: browsing users, new streams per second and length, all at once. */
  mixedUsers: number;
  mixedStreams: number;
  mixedDuration: string;
  /** Upper bound on the virtual users of the arrival-rate scenarios. */
  maxVus: number;
  /** Accounts the seed scenario registers (one per virtual user of the later runs). */
  seedUsers: number;
  /** Per-level thresholds, in ms. */
  restP95Ms: number;
  ttftP95Ms: number;
  /** SPEC s6: first token within this many ms of the provider emitting it (p95). */
  specTtftMs: number;
  /** Latency the LLM mock adds before its first token (compose.mock.yaml MOCK_TTFT_MS), subtracted from the measure. */
  mockTtftMs: number;
  /** Concurrent streams of the smoke run. */
  smokeStreams: number;
}

const numbers = (text: string | undefined, fallback: number[]): number[] => {
  if (!text) return fallback;
  const list = text
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);
  return list.length > 0 ? list : fallback;
};

const number = (text: string | undefined, fallback: number): number => {
  const value = Number(text);
  return text !== undefined && text !== "" && Number.isFinite(value) && value > 0 ? value : fallback;
};

export function readSettings(env: Env): Settings {
  const name = (env["SCENARIO"] ?? "smoke") as ScenarioName;
  if (!SCENARIO_NAMES.includes(name)) {
    throw new Error(`Unknown SCENARIO "${name}", use one of: ${SCENARIO_NAMES.join(", ")}`);
  }
  return {
    scenario: name,
    userLevels: numbers(env["USER_LEVELS"], [100, 200, 400, 700, 1000]),
    streamLevels: numbers(env["STREAM_LEVELS"], [20, 30, 40, 50, 60]),
    stageSeconds: number(env["STAGE_SECONDS"], 60),
    rampSeconds: number(env["RAMP_SECONDS"], 10),
    soakRate: number(env["SOAK_RATE"], 20),
    soakDuration: env["SOAK_DURATION"] || "30m",
    mixedUsers: number(env["MIXED_USERS"], MIXED_USERS),
    mixedStreams: number(env["MIXED_STREAMS"], MIXED_STREAMS_PER_SECOND),
    mixedDuration: env["MIXED_DURATION"] || MIXED_DURATION,
    maxVus: number(env["MAX_VUS"], 600),
    seedUsers: number(env["SEED_USERS"], 40),
    restP95Ms: number(env["REST_P95_MS"], 1000),
    ttftP95Ms: number(env["TTFT_P95_MS"], 1500),
    specTtftMs: number(env["SPEC_TTFT_MS"], 1000),
    mockTtftMs: number(env["MOCK_TTFT_MS"], 200),
    smokeStreams: Math.round(number(env["SMOKE_STREAMS"], 5)),
  };
}

/** Levels of the ramp that is running (the other scenarios have a single level, "0"). */
export function levelsOf(settings: Settings): number[] {
  if (settings.scenario === "users_ramp") return settings.userLevels;
  if (settings.scenario === "streams_ramp") return settings.streamLevels;
  return [];
}

/** The level a request belongs to, from the time since the test started. */
export function levelAt(settings: Settings, elapsedMs: number): string {
  const levels = levelsOf(settings);
  if (levels.length === 0) return "0";
  const index = Math.min(levels.length - 1, Math.floor(elapsedMs / (settings.stageSeconds * 1000)));
  return String(levels[index]);
}

function stages(levels: number[], settings: Settings): Array<{ duration: string; target: number }> {
  const hold = Math.max(1, settings.stageSeconds - settings.rampSeconds);
  return levels.flatMap((target) => [
    { duration: `${settings.rampSeconds}s`, target },
    { duration: `${hold}s`, target },
  ]);
}

export function buildScenarios(settings: Settings): Record<string, object> {
  switch (settings.scenario) {
    case "seed":
      return {
        seed: {
          executor: "shared-iterations",
          vus: 10,
          iterations: settings.seedUsers,
          maxDuration: "5m",
          exec: "seed",
        },
      };
    case "smoke":
      return {
        smoke: {
          executor: "per-vu-iterations",
          vus: settings.smokeStreams,
          iterations: 1,
          maxDuration: "1m",
          exec: "smoke",
        },
      };
    case "users_ramp":
      return {
        users_ramp: {
          executor: "ramping-vus",
          startVUs: 0,
          stages: stages(settings.userLevels, settings),
          gracefulRampDown: "5s",
          exec: "browse",
        },
      };
    case "streams_ramp":
      return {
        streams_ramp: {
          executor: "ramping-arrival-rate",
          startRate: 1,
          timeUnit: "1s",
          stages: stages(settings.streamLevels, settings),
          preAllocatedVUs: Math.min(settings.maxVus, 50),
          maxVUs: settings.maxVus,
          gracefulStop: "30s",
          exec: "stream",
        },
      };
    case "mixed":
      return mixedScenarios(settings);
    case "soak":
      return {
        soak: {
          executor: "constant-arrival-rate",
          rate: settings.soakRate,
          timeUnit: "1s",
          duration: settings.soakDuration,
          preAllocatedVUs: Math.min(settings.maxVus, 50),
          maxVUs: settings.maxVus,
          gracefulStop: "30s",
          exec: "stream",
        },
      };
  }
}

type Thresholds = Record<string, string[]>;

/**
 * Saturation thresholds. The overall ones fail the run; the `level` ones tell which level
 * broke first. None aborts the run, so a ramp always goes through every level.
 */
export function buildThresholds(settings: Settings): Thresholds {
  const rest = `p(95)<${settings.restP95Ms}`;
  // Smoke checks SPEC s6: p95 TTFT under specTtftMs with the mock's own latency subtracted. Every
  // sample contains the same mockTtftMs, so the p95 limit is shifted by it.
  const ttft =
    settings.scenario === "smoke" ? `p(95)<${settings.specTtftMs + settings.mockTtftMs}` : `p(95)<${settings.ttftP95Ms}`;
  if (settings.scenario === "mixed") return mixedThresholds(settings);
  const thresholds: Thresholds = {
    "http_req_duration{kind:rest}": [rest],
    "http_req_failed{kind:rest}": ["rate<0.01"],
  };
  if (settings.scenario !== "users_ramp") {
    thresholds["time_to_first_token"] = [ttft];
    thresholds["stream_success_rate"] = ["rate>0.99"];
  }
  for (const level of levelsOf(settings)) {
    thresholds[`http_req_duration{kind:rest,level:${level}}`] = [rest];
    thresholds[`http_req_failed{kind:rest,level:${level}}`] = ["rate<0.01"];
    if (settings.scenario === "streams_ramp") {
      thresholds[`time_to_first_token{level:${level}}`] = [ttft];
      thresholds[`stream_success_rate{level:${level}}`] = ["rate>0.99"];
      // Always true: only makes k6 report the stream duration of each level in the summary.
      thresholds[`stream_duration{level:${level}}`] = ["max>=0"];
    }
  }
  return thresholds;
}

export function buildOptions(env: Env) {
  const settings = readSettings(env);
  return {
    settings,
    options: {
      scenarios: buildScenarios(settings),
      thresholds: buildThresholds(settings),
      summaryTrendStats: ["avg", "min", "med", "p(90)", "p(95)", "max"],
    },
  };
}
