import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./main.js";
import { http } from "./shared/contracts/index.js";

describe("app bootstrap (PLAN.md B1)", () => {
  it("AC-88, AC-89: GET /health responds 200 and echoes/generates a correlation id", async () => {
    const res = await request(createApp()).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
    expect(res.headers[http.CORRELATION_HEADER.toLowerCase()]).toBeTruthy();
  });

  it("AC-88: propagates an incoming X-Correlation-Id unchanged", async () => {
    const res = await request(createApp())
      .get("/health")
      .set(http.CORRELATION_HEADER, "incoming-corr-id");

    expect(res.headers[http.CORRELATION_HEADER.toLowerCase()]).toBe("incoming-corr-id");
  });

  it("exposes Prometheus metrics on GET /metrics", async () => {
    const res = await request(createApp()).get("/metrics");

    expect(res.status).toBe(200);
    expect(res.text).toContain("auth_service_");
  });

  it("counts HTTP requests by route template and status in http_requests_total", async () => {
    const app = createApp();
    await request(app).post("/auth/register").send({ email: "not-an-email", password: "short" });
    await request(app).get("/does-not-exist");

    const res = await request(app).get("/metrics");

    expect(res.text).toMatch(/http_requests_total\{method="POST",route="\/auth\/register",status="400"\} \d+/);
    expect(res.text).toMatch(/http_requests_total\{method="GET",route="unmatched",status="404"\} \d+/);
    expect(res.text).toContain("http_request_duration_seconds_bucket");
  });

  it("sets security headers via helmet", async () => {
    const res = await request(createApp()).get("/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("returns a uniform 404 body for an unknown route", async () => {
    const res = await request(createApp()).get("/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("AC-32: rejects a malformed registration body with a 400 VALIDATION_ERROR (routes are wired under /auth)", async () => {
    const res = await request(createApp())
      .post("/auth/register")
      .send({ email: "not-an-email", password: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
