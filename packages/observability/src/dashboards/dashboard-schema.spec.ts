import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Schema checks for every Grafana dashboard JSON under
 * `observability/grafana/provisioning/dashboards/`. Threshold: the 3 dashboards that had no
 * tests (frontend-faro, web-vitals-by-page, load-test) are valid, and no panel anywhere
 * lacks a datasource.
 */

const dashboardsDir = fileURLToPath(
  new URL("../../../../observability/grafana/provisioning/dashboards/", import.meta.url),
);

const UNTESTED = ["frontend-faro", "web-vitals-by-page", "load-test"];

interface Panel {
  id?: unknown;
  type?: unknown;
  title?: unknown;
  datasource?: unknown;
  targets?: Array<{ datasource?: unknown }>;
  panels?: Panel[];
}

interface Dashboard {
  uid?: unknown;
  title?: unknown;
  schemaVersion?: unknown;
  panels?: Panel[];
}

function listFiles(): string[] {
  return readdirSync(dashboardsDir)
    .filter((f) => f.endsWith(".json"))
    .sort();
}

function load(file: string): Dashboard {
  return JSON.parse(readFileSync(`${dashboardsDir}${file}`, "utf-8")) as Dashboard;
}

function flatten(panels: Panel[]): Panel[] {
  return panels.flatMap((p) => [p, ...flatten(p.panels ?? [])]);
}

function hasDatasource(ds: unknown): boolean {
  if (typeof ds === "string") return ds.length > 0;
  if (ds && typeof ds === "object") {
    const o = ds as { uid?: unknown; type?: unknown };
    return typeof o.uid === "string" && o.uid.length > 0;
  }
  return false;
}

describe("Grafana dashboard JSON schema", () => {
  const files = listFiles();

  it("ships the 3 previously untested dashboards", () => {
    for (const name of UNTESTED) expect(files).toContain(`${name}.json`);
  });

  describe.each(files)("%s", (file) => {
    const dashboard = load(file);
    const all = flatten(dashboard.panels ?? []);
    const visual = all.filter((p) => p.type !== "row");

    it("has uid, title, schemaVersion and a non-empty panels array", () => {
      expect(typeof dashboard.uid).toBe("string");
      expect(dashboard.uid).not.toBe("");
      expect(typeof dashboard.title).toBe("string");
      expect(dashboard.title).not.toBe("");
      expect(typeof dashboard.schemaVersion).toBe("number");
      expect(Array.isArray(dashboard.panels)).toBe(true);
      expect(visual.length).toBeGreaterThan(0);
    });

    it("has unique panel ids and a type on every panel", () => {
      const ids = all.map((p) => p.id);
      expect(ids.every((id) => typeof id === "number")).toBe(true);
      expect(new Set(ids).size).toBe(ids.length);
      expect(all.every((p) => typeof p.type === "string" && p.type !== "")).toBe(true);
    });

    it("has 0 panels without a datasource", () => {
      const missing = visual
        .filter((p) => {
          const targets = p.targets ?? [];
          if (targets.length === 0) return !hasDatasource(p.datasource);
          return targets.some((t) => !hasDatasource(t.datasource ?? p.datasource));
        })
        .map((p) => `${String(p.id)}:${String(p.title)}`);
      expect(missing).toEqual([]);
    });
  });
});
