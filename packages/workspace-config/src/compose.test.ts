import { existsSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { readRepoFile, repoRoot } from "./repo.ts";

const compose = parse(readRepoFile("compose.yaml"));

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
  ])("AC-5: compose.yaml defines a `%s` service", (service) => {
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
  it("AC-6: compose.yaml defines prometheus and grafana services", () => {
    expect(compose.services).toHaveProperty("prometheus");
    expect(compose.services).toHaveProperty("grafana");
  });

  it("AC-6: the prometheus image bakes in observability/prometheus.yml as its scrape config", () => {
    const dockerfile = compose.services.prometheus.build.dockerfile;
    expect(dockerfile).toBe("observability/prometheus.Dockerfile");
    expect(readRepoFile(dockerfile)).toMatch(/^COPY observability\/prometheus\.yml \/etc\/prometheus\/prometheus\.yml$/m);
  });

  it("AC-6: prometheus.yml scrapes auth-service and conversation-service /metrics", () => {
    const prometheusConfig = parse(readRepoFile("observability/prometheus.yml"));
    const jobNames = prometheusConfig.scrape_configs.map((c: { job_name: string }) => c.job_name);
    expect(jobNames).toEqual(expect.arrayContaining(["auth-service", "conversation-service"]));
    for (const job of prometheusConfig.scrape_configs.filter((c: { job_name: string }) =>
      ["auth-service", "conversation-service"].includes(c.job_name),
    )) {
      expect(job.metrics_path).toBe("/metrics");
    }
  });

  it("AC-6: grafana is pre-wired with a provisioned Prometheus datasource", () => {
    const dockerfile = compose.services.grafana.build.dockerfile;
    expect(dockerfile).toBe("observability/grafana.Dockerfile");
    expect(readRepoFile(dockerfile)).toMatch(/^COPY observability\/grafana\/provisioning /m);

    const datasource = parse(
      readRepoFile("observability/grafana/provisioning/datasources/datasource.yml"),
    );
    const datasources = datasource.datasources ?? [];
    expect(datasources.some((d: { type: string }) => d.type === "prometheus")).toBe(true);
  });
});

describe("compose.yaml is the only local compose file (AICHAT-231)", () => {
  it("the legacy docker-compose.yml is gone", () => {
    expect(existsSync(join(repoRoot, "docker-compose.yml"))).toBe(false);
  });

  it("every published port is bound to 127.0.0.1", () => {
    for (const [name, service] of Object.entries<{ ports?: unknown[] }>(compose.services)) {
      for (const port of service.ports ?? []) expect(String(port), name).toMatch(/^127\.0\.0\.1:/);
    }
  });

  it("postgres is not published at all", () => {
    expect(compose.services.postgres.ports).toBeUndefined();
  });
});
