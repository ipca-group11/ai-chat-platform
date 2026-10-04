import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Structural checks on the provisioned Grafana dashboard `web-vitals-by-page.json` (AICHAT-98): it must be picked up
 * by the provisioning provider, query the Faro web-vitals in Loki, and show LCP, INP and CLS at the 75th percentile
 * broken down by page, with the chat id folded into one `/chats/:id` row.
 */

const root = new URL("../../../", import.meta.url);
const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, root)), "utf-8");
const dir = "observability/grafana/provisioning/dashboards";
const dashboard = JSON.parse(read(`${dir}/web-vitals-by-page.json`)) as {
  uid: string;
  panels: { title: string; targets: { expr: string; datasource: { type: string; uid: string } }[] }[];
};
const queries = dashboard.panels.flatMap((panel) => panel.targets.map((target) => target.expr));

describe("Web Vitals by page dashboard (AICHAT-98)", () => {
  it("has a stable uid and sits in the folder the provider reads", () => {
    expect(dashboard.uid).toBe("web-vitals-by-page");
    expect(read(`${dir}/dashboards.yml`)).toContain("path: /etc/grafana/provisioning/dashboards");
  });

  it("queries the Faro web-vitals measurements in Loki", () => {
    for (const panel of dashboard.panels) {
      for (const target of panel.targets) expect(target.datasource).toEqual({ type: "loki", uid: "loki" });
    }
    for (const expr of queries) expect(expr).toContain('kind="measurement"} | logfmt | type="web-vitals"');
  });

  it("shows the 75th percentile of LCP, INP and CLS per page", () => {
    for (const vital of ["lcp", "inp", "cls"]) {
      expect(queries.some((expr) => expr.includes("quantile_over_time(0.75") && expr.includes(`unwrap ${vital} `) && expr.includes("by (page)"))).toBe(true);
    }
  });

  it("folds the chat id into /chats/:id so the page label has few values", () => {
    for (const expr of queries) expect(expr).toContain('"/chats/:id"');
  });
});
