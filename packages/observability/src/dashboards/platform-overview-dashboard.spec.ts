import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Structural checks on the Grafana dashboard (O3, AC-92) that this pod owns under
 * `observability/grafana/provisioning/dashboards/`. These don't render the dashboard (that
 * needs a real Grafana + Prometheus, see compose.yaml, platform-foundation-owned),
 * but they pin down the contract: the provider config points Grafana at this folder, and
 * the dashboard JSON visualizes request rate, latency, error rate, and active-stream
 * metrics for every service scraped by Prometheus, using the exact metric names this
 * package (`packages/observability`, O2) exposes.
 */

const dashboardsDir = fileURLToPath(
  new URL("../../../../observability/grafana/provisioning/dashboards/", import.meta.url),
);

function readDashboard(): Record<string, unknown> {
  const raw = readFileSync(`${dashboardsDir}platform-overview.json`, "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

function readProviderConfig(): string {
  return readFileSync(`${dashboardsDir}dashboards.yml`, "utf-8");
}

describe("Grafana dashboard provider config (AC-92)", () => {
  it("AC-92: points Grafana at the dashboards folder so files here are auto-loaded", () => {
    const yaml = readProviderConfig();

    expect(yaml).toMatch(/type:\s*file/);
    expect(yaml).toMatch(/path:\s*\/etc\/grafana\/provisioning\/dashboards/);
  });
});

describe("docker-compose auto-start contract (AC-93)", () => {
  // AC-93 ("Prometheus and Grafana start automatically as part of `docker compose up`")
  // is platform-foundation's compose wiring, not this pod's file to own or test directly
  // (compose.yaml isn't part of this pod - see PLAN.md "Ownership"/"Cross-pod
  // dependencies"). What this pod *can* pin down and test is the provisioning-path
  // contract that compose file must honor for AC-92's dashboard to actually appear once
  // both are merged: Grafana must be started with this folder mounted at the path below.
  it("AC-93: documents the cross-pod dependency on platform-foundation's compose wiring", () => {
    const yaml = readProviderConfig();

    expect(yaml).toMatch(/AC-93/);
    expect(yaml).toMatch(/platform-foundation/);
  });

  it("AC-93: publishes the exact provisioning path platform-foundation's compose must mount", () => {
    const yaml = readProviderConfig();

    expect(yaml).toMatch(/path:\s*\/etc\/grafana\/provisioning\/dashboards/);
  });
});

describe("Platform overview dashboard (AC-92)", () => {
  it("AC-92: ships as a preconfigured dashboard JSON with a stable uid/title", () => {
    const dashboard = readDashboard();

    expect(dashboard.uid).toBe("platform-overview");
    expect(dashboard.title).toBe("Platform overview");
  });

  it("AC-92: repeats a row per service using the Prometheus job label", () => {
    const dashboard = readDashboard();
    const panels = dashboard.panels as Array<Record<string, unknown>>;
    const row = panels.find((panel) => panel.type === "row");

    expect(row).toBeDefined();
    expect(row?.repeat).toBe("job");
  });

  it("AC-92: visualizes request rate from http_requests_total", () => {
    const dashboard = readDashboard();
    const panels = dashboard.panels as Array<Record<string, unknown>>;
    const requestRate = panels.find((panel) => panel.title === "Request rate ($job)");

    expect(requestRate).toBeDefined();
    const targets = requestRate?.targets as Array<Record<string, unknown>>;
    expect(String(targets[0]?.expr)).toContain("http_requests_total");
  });

  it("AC-92: visualizes error rate from http_requests_total", () => {
    const dashboard = readDashboard();
    const panels = dashboard.panels as Array<Record<string, unknown>>;
    const errorRate = panels.find((panel) => panel.title === "Error rate ($job)");

    expect(errorRate).toBeDefined();
    const targets = errorRate?.targets as Array<Record<string, unknown>>;
    expect(String(targets[0]?.expr)).toContain("http_requests_total");
    expect(String(targets[0]?.expr)).toContain(`status=~"5.."`);
  });

  it("AC-92: visualizes p50 and p95 latency from http_request_duration_seconds", () => {
    const dashboard = readDashboard();
    const panels = dashboard.panels as Array<Record<string, unknown>>;
    const p50 = panels.find((panel) => panel.title === "Latency p50 ($job)");
    const p95 = panels.find((panel) => panel.title === "Latency p95 ($job)");

    expect(p50).toBeDefined();
    expect(p95).toBeDefined();
    expect(String((p50?.targets as Array<Record<string, unknown>>)[0]?.expr)).toContain(
      "http_request_duration_seconds_bucket",
    );
    expect(String((p95?.targets as Array<Record<string, unknown>>)[0]?.expr)).toContain(
      "histogram_quantile(0.95",
    );
  });

  it("AC-92: visualizes active streams from the active_streams gauge", () => {
    const dashboard = readDashboard();
    const panels = dashboard.panels as Array<Record<string, unknown>>;
    const activeStreams = panels.find((panel) => panel.title === "Active streams ($job)");

    expect(activeStreams).toBeDefined();
    const targets = activeStreams?.targets as Array<Record<string, unknown>>;
    expect(String(targets[0]?.expr)).toContain("active_streams");
  });
});
