/**
 * NFR H4: brute-force protection. Login must answer 429 once a single IP has made
 * more than MAX_FAILED_LOGINS_PER_MINUTE failed attempts, and the conversation
 * service must have a rate limiter wired into its app.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildTestApp } from "../test-utils/build-test-app.js";
import { PASSWORD, registerVia } from "../test-utils/session-helpers.js";

const MAX_FAILED_LOGINS_PER_MINUTE = 10;

describe("auth brute-force rate limit (H4)", () => {
  it("POST /auth/login · answers 429 within 10 failed attempts from one IP", async () => {
    const { app } = buildTestApp();
    await registerVia(app, "ana@example.com");

    const statuses: number[] = [];
    for (let i = 0; i < MAX_FAILED_LOGINS_PER_MINUTE + 2; i++) {
      const res = await request(app)
        .post("/auth/login")
        .set("X-Forwarded-For", "203.0.113.7")
        .send({ email: "ana@example.com", password: "wrong-password1" });
      statuses.push(res.status);
    }

    const firstLimited = statuses.indexOf(429) + 1; // 1-based attempt number, 0 if never
    expect(firstLimited, `statuses: ${statuses.join(",")}`).toBeGreaterThan(0);
    expect(firstLimited).toBeLessThanOrEqual(MAX_FAILED_LOGINS_PER_MINUTE + 1);
    expect(statuses.slice(0, firstLimited - 1).every((s) => s === 401)).toBe(true);
  }, 60_000);

  it("conversation-service · a rate limiter is configured on the app", () => {
    const src = readFileSync(resolve(__dirname, "../../../conversation-service/src/app.ts"), "utf8");
    expect(src).toMatch(/express-rate-limit/);
    expect(src).toMatch(/rateLimit\s*\(/);
  });
});
