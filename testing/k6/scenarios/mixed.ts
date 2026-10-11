import type { Settings } from "../lib/scenarios.ts";

/**
 * NFR scenario "mixed": browsing users and new streams run together.
 * Requirement: 100 users + 30 streams/s -> REST p95 < 1000 ms, TTFT p95 < 1500 ms, failures < 1 %.
 * Pure TypeScript with no k6 imports, so Vitest checks it. Run: bash testing/k6/run.sh mixed
 */

export const MIXED_USERS = 100;
export const MIXED_STREAMS_PER_SECOND = 30;
export const MIXED_DURATION = "3m";

export function mixedScenarios(settings: Settings): Record<string, object> {
  return {
    mixed_users: {
      executor: "constant-vus",
      vus: settings.mixedUsers,
      duration: settings.mixedDuration,
      gracefulStop: "10s",
      exec: "browse",
    },
    mixed_streams: {
      executor: "constant-arrival-rate",
      rate: settings.mixedStreams,
      timeUnit: "1s",
      duration: settings.mixedDuration,
      preAllocatedVUs: Math.min(settings.maxVus, 50),
      maxVUs: settings.maxVus,
      gracefulStop: "30s",
      exec: "stream",
    },
  };
}

/** Every threshold fails the run (exit code 99) and none aborts it. */
export function mixedThresholds(settings: Settings): Record<string, string[]> {
  return {
    "http_req_duration{kind:rest}": [`p(95)<${settings.restP95Ms}`],
    "http_req_failed{kind:rest}": ["rate<0.01"],
    time_to_first_token: [`p(95)<${settings.ttftP95Ms}`],
    stream_success_rate: ["rate>0.99"],
  };
}
