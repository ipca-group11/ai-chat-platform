import { describe, expect, it } from "vitest";
import { decActiveStream, incActiveStream } from "./active-stream-gauge.js";
import { createMetricsRegistry } from "./registry.js";

describe("active-stream-gauge", () => {
  it("AC-91: incActiveStream increments the gauge for a service", async () => {
    const metrics = createMetricsRegistry();

    incActiveStream(metrics, "conversation-service");
    incActiveStream(metrics, "conversation-service");

    const json = await metrics.registry.getMetricsAsJSON();
    const value = json
      .find((m) => m.name === "active_streams")
      ?.values.find((v) => v.labels.service === "conversation-service");
    expect(value?.value).toBe(2);
  });

  it("AC-91: decActiveStream decrements the gauge for a service", async () => {
    const metrics = createMetricsRegistry();

    incActiveStream(metrics, "conversation-service");
    incActiveStream(metrics, "conversation-service");
    decActiveStream(metrics, "conversation-service");

    const json = await metrics.registry.getMetricsAsJSON();
    const value = json
      .find((m) => m.name === "active_streams")
      ?.values.find((v) => v.labels.service === "conversation-service");
    expect(value?.value).toBe(1);
  });

  it("AC-91: tracks separate services independently", async () => {
    const metrics = createMetricsRegistry();

    incActiveStream(metrics, "conversation-service");
    incActiveStream(metrics, "auth-service");
    incActiveStream(metrics, "auth-service");

    const json = await metrics.registry.getMetricsAsJSON();
    const values = json.find((m) => m.name === "active_streams")?.values ?? [];
    expect(values.find((v) => v.labels.service === "conversation-service")?.value).toBe(1);
    expect(values.find((v) => v.labels.service === "auth-service")?.value).toBe(2);
  });
});
