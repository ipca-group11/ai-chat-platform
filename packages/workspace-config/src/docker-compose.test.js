import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { readRepoFile } from "./repo.js";

const compose = parse(readRepoFile("docker-compose.yml"));

describe("AC-5: a single `docker compose up` starts every app, service, Postgres, and Ollama", () => {
  it.each([
    "shell",
    "mfe-auth",
    "mfe-chat",
    "mfe-settings",
    "auth-service",
    "conversation-service",
    "postgres",
    "ollama",
  ])("AC-5: docker-compose.yml defines a `%s` service", (service) => {
    expect(compose.services).toHaveProperty(service);
  });

  it("AC-5: auth-service and conversation-service build from their own Dockerfile path", () => {
    expect(compose.services["auth-service"].build.dockerfile).toBe("services/auth-service/Dockerfile");
    expect(compose.services["conversation-service"].build.dockerfile).toBe(
      "services/conversation-service/Dockerfile",
    );
  });

  it("AC-5: shell, mfe-auth, mfe-chat, mfe-settings build from their own Dockerfile path", () => {
    for (const app of ["shell", "mfe-auth", "mfe-chat", "mfe-settings"]) {
      expect(compose.services[app].build.dockerfile).toBe(`apps/${app}/Dockerfile`);
    }
  });

  it("AC-5: postgres and ollama have healthchecks so dependents wait until they're ready", () => {
    expect(compose.services.postgres.healthcheck).toBeDefined();
    expect(compose.services.ollama.healthcheck).toBeDefined();
  });
});

describe("AC-6: Docker Compose also starts Prometheus and Grafana pre-wired to scrape the services", () => {
  it("AC-6: docker-compose.yml defines prometheus and grafana services", () => {
    expect(compose.services).toHaveProperty("prometheus");
    expect(compose.services).toHaveProperty("grafana");
  });

  it("AC-6: prometheus mounts observability/prometheus.yml as its scrape config", () => {
    const volumes = compose.services.prometheus.volumes ?? [];
    expect(volumes.some((v) => v.startsWith("./observability/prometheus.yml:"))).toBe(true);
  });

  it("AC-6: prometheus.yml scrapes auth-service and conversation-service /metrics", () => {
    const prometheusConfig = parse(readRepoFile("observability/prometheus.yml"));
    const jobNames = prometheusConfig.scrape_configs.map((c) => c.job_name);
    expect(jobNames).toEqual(expect.arrayContaining(["auth-service", "conversation-service"]));
    for (const job of prometheusConfig.scrape_configs.filter((c) =>
      ["auth-service", "conversation-service"].includes(c.job_name),
    )) {
      expect(job.metrics_path).toBe("/metrics");
    }
  });

  it("AC-6: grafana is pre-wired with a provisioned Prometheus datasource", () => {
    expect(compose.services.grafana).toBeDefined();
    const volumes = compose.services.grafana.volumes ?? [];
    expect(volumes.some((v) => v.includes("observability/grafana/provisioning"))).toBe(true);

    const datasource = parse(
      readRepoFile("observability/grafana/provisioning/datasources/datasource.yml"),
    );
    const datasources = datasource.datasources ?? [];
    expect(datasources.some((d) => d.type === "prometheus")).toBe(true);
  });
});
