import { describe, expect, it } from "vitest";
import { durationToHours, lokiRetentionProblems, readLokiConfig } from "./loki-retention.ts";

const config = (retentionPeriod: unknown, retentionEnabled: unknown = true) => ({
  limits_config: retentionPeriod === undefined ? {} : { retention_period: retentionPeriod },
  compactor: { retention_enabled: retentionEnabled },
});

describe("AICHAT-140: Loki keeps telemetry for at most 7 days", () => {
  it("observability/loki.yml has a retention period of 7 days or less, enforced by the compactor", () => {
    expect(lokiRetentionProblems(readLokiConfig())).toEqual([]);
  });
});

describe("lokiRetentionProblems", () => {
  it.each(["168h", "7d", "1w", "6d23h", "10080m", "1h"])("accepts %s", (period) => {
    expect(lokiRetentionProblems(config(period))).toEqual([]);
  });

  it("fails when the retention period is removed", () => {
    expect(lokiRetentionProblems(config(undefined))).toEqual([expect.stringContaining("retention_period is missing")]);
    expect(lokiRetentionProblems({})).toHaveLength(2);
  });

  it.each(["169h", "8d", "2w", "336h", "720h", "7d1s", "1y"])("fails when it is raised to %s", (period) => {
    expect(lokiRetentionProblems(config(period))).toEqual([expect.stringContaining("above the 7 days")]);
  });

  it.each(["0s", "0h"])("fails for %s, which Loki reads as keep forever", (period) => {
    expect(lokiRetentionProblems(config(period))).toEqual([expect.stringContaining("keep forever")]);
  });

  it.each(["seven days", 168, "", "168"])("fails for %j, which is not a duration", (period) => {
    expect(lokiRetentionProblems(config(period))).toEqual([expect.stringContaining("not a duration")]);
  });

  it("fails when the compactor does not apply retention", () => {
    expect(lokiRetentionProblems(config("168h", false))).toEqual([expect.stringContaining("retention_enabled")]);
    expect(lokiRetentionProblems({ limits_config: { retention_period: "168h" } })).toHaveLength(1);
  });
});

describe("durationToHours", () => {
  it("adds the parts of a duration", () => {
    expect(durationToHours("1d12h")).toBe(36);
    expect(durationToHours("90m")).toBe(1.5);
  });

  it("returns undefined for anything else", () => {
    expect(durationToHours("abc")).toBeUndefined();
    expect(durationToHours(undefined)).toBeUndefined();
  });
});
