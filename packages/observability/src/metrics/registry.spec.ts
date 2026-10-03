import { describe, expect, it } from "vitest";
import { createMetricsRegistry } from "./registry.js";

describe("createMetricsRegistry", () => {
  it("AC-91: registers http_requests_total, http_request_duration_seconds, and active_streams", async () => {
    const { registry } = createMetricsRegistry();
    const metricNames = (await registry.getMetricsAsJSON()).map((m) => m.name);

    expect(metricNames).toContain("http_requests_total");
    expect(metricNames).toContain("http_request_duration_seconds");
    expect(metricNames).toContain("active_streams");
  });

  it("AC-91: each call returns an isolated registry (no cross-test leakage)", async () => {
    const a = createMetricsRegistry();
    const b = createMetricsRegistry();

    a.httpRequestsTotal.inc({ method: "GET", route: "/x", status: "200" });

    const bMetrics = await b.registry.getMetricsAsJSON();
    const bCounter = bMetrics.find((m) => m.name === "http_requests_total");
    expect(bCounter?.values).toHaveLength(0);
  });

  it("AC-91: httpRequestsTotal increments per method/route/status label combination", async () => {
    const { registry, httpRequestsTotal } = createMetricsRegistry();

    httpRequestsTotal.inc({ method: "GET", route: "/chats", status: "200" });
    httpRequestsTotal.inc({ method: "GET", route: "/chats", status: "200" });
    httpRequestsTotal.inc({ method: "POST", route: "/chats", status: "500" });

    const metric = (await registry.getMetricsAsJSON()).find(
      (m) => m.name === "http_requests_total",
    );
    const okValue = metric?.values.find(
      (v) => v.labels.method === "GET" && v.labels.status === "200",
    );
    const errorValue = metric?.values.find(
      (v) => v.labels.method === "POST" && v.labels.status === "500",
    );

    expect(okValue?.value).toBe(2);
    expect(errorValue?.value).toBe(1);
  });

  it("AC-91: httpRequestDurationSeconds observes a duration", async () => {
    const { registry, httpRequestDurationSeconds } = createMetricsRegistry();

    httpRequestDurationSeconds.observe({ method: "GET", route: "/chats", status: "200" }, 0.42);

    const metric = (await registry.getMetricsAsJSON()).find(
      (m) => m.name === "http_request_duration_seconds",
    );
    const sumValue = metric?.values.find((v) => v.metricName?.endsWith("_sum"));
    expect(sumValue?.value).toBeGreaterThanOrEqual(0.42);
  });

  it("AC-91: activeStreams gauge increments and decrements correctly", async () => {
    const { registry, activeStreams } = createMetricsRegistry();

    activeStreams.inc({ service: "conversation-service" });
    activeStreams.inc({ service: "conversation-service" });
    activeStreams.dec({ service: "conversation-service" });

    const metric = (await registry.getMetricsAsJSON()).find((m) => m.name === "active_streams");
    const value = metric?.values.find((v) => v.labels.service === "conversation-service");
    expect(value?.value).toBe(1);
  });
});
