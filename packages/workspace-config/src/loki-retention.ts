// Telemetry retention guard (AICHAT-140, GDPR Art. 5(1)(e)): logs and Faro events live in Loki for at most 7
// days (docs/AICHAT-33/RETENTION.md). These helpers read `observability/loki.yml` and say what is wrong with it.
import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { parse } from "yaml";
import { readRepoFile } from "./repo.ts";

export const LOKI_CONFIG = "observability/loki.yml";
export const MAX_RETENTION_HOURS = 168;

const UNIT_HOURS: Record<string, number> = { ms: 1 / 3_600_000, s: 1 / 3600, m: 1 / 60, h: 1, d: 24, w: 168, y: 8760 };

/** Hours in a Loki/Prometheus duration such as `168h`, `7d`, `1w` or `1d12h`; undefined when it is not one. */
export function durationToHours(value: unknown): number | undefined {
  if (typeof value !== "string" || !/^(\d+(ms|s|m|h|d|w|y))+$/.test(value)) return undefined;
  let hours = 0;
  for (const [, amount, unit] of value.matchAll(/(\d+)(ms|s|m|h|d|w|y)/g)) {
    hours += Number(amount) * (UNIT_HOURS[unit as string] as number);
  }
  return hours;
}

/** What is wrong with the retention settings of a Loki config; an empty list means it is fine. */
export function lokiRetentionProblems(config: unknown): string[] {
  const doc = (config ?? {}) as { limits_config?: { retention_period?: unknown }; compactor?: { retention_enabled?: unknown } };
  const problems: string[] = [];

  if (doc.compactor?.retention_enabled !== true) {
    problems.push("compactor.retention_enabled must be true, otherwise Loki never deletes old data");
  }

  const period = doc.limits_config?.retention_period;
  if (period === undefined) {
    problems.push("limits_config.retention_period is missing: Loki would keep telemetry forever");
    return problems;
  }
  const hours = durationToHours(period);
  if (hours === undefined) {
    problems.push(`limits_config.retention_period "${String(period)}" is not a duration such as 168h or 7d`);
  } else if (hours > MAX_RETENTION_HOURS) {
    problems.push(`limits_config.retention_period ${String(period)} (${hours} h) is above the 7 days (${MAX_RETENTION_HOURS} h) in the retention table`);
  } else if (hours <= 0) {
    problems.push(`limits_config.retention_period ${String(period)} is zero, which means "keep forever" in Loki`);
  }
  return problems;
}

/**
 * What stops Loki from erasing lines on request (AICHAT-249): the delete API of scripts/gdpr/loki-delete.ts needs a
 * delete request store on the compactor and `deletion_mode: filter-and-delete`. An empty list means it is fine.
 */
export function lokiDeletionProblems(config: unknown): string[] {
  const doc = (config ?? {}) as {
    limits_config?: { deletion_mode?: unknown };
    compactor?: { retention_enabled?: unknown; delete_request_store?: unknown };
  };
  const problems: string[] = [];
  if (doc.compactor?.retention_enabled !== true) {
    problems.push("compactor.retention_enabled must be true, otherwise the compactor never processes delete requests");
  }
  if (typeof doc.compactor?.delete_request_store !== "string" || doc.compactor.delete_request_store === "") {
    problems.push("compactor.delete_request_store is missing: the delete API is not served");
  }
  if (doc.limits_config?.deletion_mode !== "filter-and-delete") {
    problems.push(`limits_config.deletion_mode must be filter-and-delete, not ${JSON.stringify(doc.limits_config?.deletion_mode)}`);
  }
  return problems;
}

/** The Loki config to check: `LOKI_CONFIG_PATH` (an absolute path to a copy, used to show the test fails) or the one in the repo. */
export function readLokiConfig(): unknown {
  const override = process.env.LOKI_CONFIG_PATH;
  const text = override && isAbsolute(override) ? readFileSync(override, "utf8") : readRepoFile(LOKI_CONFIG);
  return parse(text);
}
