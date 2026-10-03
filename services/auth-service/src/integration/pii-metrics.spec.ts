/**
 * AICHAT-127: /metrics carries no PII. Sends traffic with planted fake PII in paths, query
 * strings, bodies and headers (matched routes and unmatched ones), scrapes /metrics and runs
 * the shared detector over the whole scrape.
 */
import { describePii, findPii } from "@platform/pii-detector";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "../test-utils/build-test-app.js";
import { loginVia, registerVia } from "../test-utils/session-helpers.js";

const CANARY = "PII-CANARY-7f3a";
const EMAIL = "ana.metrics@pii-canary.example.com";
const CLIENT_IP = "203.0.113.77";
const canaries = [CANARY, EMAIL, CLIENT_IP];

async function scrape(app: ReturnType<typeof buildTestApp>["app"]): Promise<string> {
  const res = await request(app).get("/metrics");
  expect(res.status).toBe(200);
  return res.text;
}

describe("auth-service /metrics carries no PII", () => {
  it("stays clean after traffic on matched and unmatched routes", async () => {
    const { app } = buildTestApp();
    const from = { "X-Forwarded-For": CLIENT_IP };

    await registerVia(app, EMAIL);
    await loginVia(app, EMAIL);
    await request(app).post("/auth/login").set(from).send({ email: EMAIL, password: "wrong-password1" });
    await request(app).get(`/auth/me?email=${EMAIL}&note=${CANARY}`).set(from);
    await request(app).get(`/nope/${EMAIL}?note=${CANARY}`).set(from);
    await request(app).get(`/nope/${encodeURIComponent(EMAIL)}/${CLIENT_IP}`).set(from);

    const text = await scrape(app);
    expect(text).toContain("http_requests_total");
    expect(describePii(findPii(text, { canaries }))).toBe("");
  });

  it("labels a route nobody handles as unmatched, never with the raw URL", async () => {
    const { app } = buildTestApp();
    const res = await request(app).get(`/nope/${EMAIL}?note=${CANARY}`);
    expect(res.status).toBe(404);

    const text = await scrape(app);
    expect(text).toMatch(/http_requests_total\{[^}]*route="unmatched"[^}]*status="404"[^}]*\} \d+/);
    expect(text).not.toContain("/nope");
  });
});
