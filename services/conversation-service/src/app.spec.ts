import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { parseEnv } from "./shared/env.js";
import { createLogger } from "./shared/logger.js";
import type { PrismaClient } from "./shared/prisma.js";

function buildApp() {
  const env = parseEnv({ JWT_SECRET: "test-secret" });
  const logger = createLogger("silent");
  // Only /health and /metrics are exercised here; no repository method that would touch
  // Prisma is invoked, so an empty stub is sufficient for this smoke test.
  const prisma = {} as PrismaClient;
  return createApp(prisma, env, logger);
}

describe("app", () => {
  it("AC-45: exposes an unauthenticated /health endpoint", async () => {
    const app = buildApp();
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("AC-45: exposes a Prometheus /metrics endpoint", async () => {
    const app = buildApp();
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.text).toContain("http_request_duration_seconds");
  });

  it("AC-45: every /chats route requires authentication", async () => {
    const app = buildApp();
    const res = await request(app).get("/chats");
    expect(res.status).toBe(401);
  });

  it("echoes the correlation id header on every response (STACK.md decision #8)", async () => {
    const app = buildApp();
    const res = await request(app).get("/health").set("X-Correlation-Id", "my-correlation-id");
    expect(res.headers["x-correlation-id"]).toBe("my-correlation-id");
  });
});
