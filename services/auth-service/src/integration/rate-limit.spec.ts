/** The global rate limit behind a reverse proxy (AICHAT-222): one budget per real client, not one for everyone. */
import request from "supertest";
import { describe, expect, it } from "vitest";
import { loadEnv } from "../shared/env.js";
import { buildTestApp } from "../test-utils/build-test-app.js";

const ALICE = "203.0.113.10";
const BOB = "198.51.100.20";

function viaProxy(app: Parameters<typeof request>[0], forwardedFor: string) {
  return request(app).get("/health").set("X-Forwarded-For", forwardedFor);
}

describe("rate limit behind Caddy (trust proxy 1)", () => {
  it("counts each client address on its own: one client hitting the limit does not block another", async () => {
    const { app } = buildTestApp(undefined, { requestsPerWindow: 2 });

    expect((await viaProxy(app, ALICE)).status).toBe(200);
    expect((await viaProxy(app, ALICE)).status).toBe(200);
    const blocked = await viaProxy(app, ALICE);
    expect(blocked.status).toBe(429);

    const other = await viaProxy(app, BOB);
    expect(other.status).toBe(200);
    expect(other.headers["ratelimit-remaining"]).toBe("1");
  });

  it("keys on the address Caddy appended, so a client cannot dodge the limit with its own X-Forwarded-For", async () => {
    const { app } = buildTestApp(undefined, { requestsPerWindow: 2 });

    // Caddy appends the real peer address to whatever the client sent; only that last entry is trusted.
    expect((await viaProxy(app, `10.0.0.1, ${ALICE}`)).status).toBe(200);
    expect((await viaProxy(app, `10.0.0.2, ${ALICE}`)).status).toBe(200);
    expect((await viaProxy(app, `10.0.0.3, ${ALICE}`)).status).toBe(429);
  });

  it("without trust proxy every request shares the proxy's address (the bug), which TRUST_PROXY=0 still allows", async () => {
    const { app } = buildTestApp(undefined, { requestsPerWindow: 2, trustProxy: 0 });

    expect((await viaProxy(app, ALICE)).status).toBe(200);
    expect((await viaProxy(app, BOB)).status).toBe(200);
    expect((await viaProxy(app, "192.0.2.30")).status).toBe(429);
  });
});

describe("TRUST_PROXY", () => {
  const base = { DATABASE_URL: "postgresql://localhost/auth", JWT_SECRET: "s" };

  it("defaults to one hop (Caddy)", () => {
    expect(loadEnv(base).TRUST_PROXY).toBe(1);
  });

  it("takes a hop count or a list of trusted addresses", () => {
    expect(loadEnv({ ...base, TRUST_PROXY: "2" }).TRUST_PROXY).toBe(2);
    expect(loadEnv({ ...base, TRUST_PROXY: "loopback, 10.0.0.0/8" }).TRUST_PROXY).toBe("loopback, 10.0.0.0/8");
  });

  it("refuses true, which would trust any X-Forwarded-For a client sends", () => {
    expect(() => loadEnv({ ...base, TRUST_PROXY: "true" })).toThrow(/TRUST_PROXY=true is not allowed/);
    expect(() => loadEnv({ ...base, TRUST_PROXY: " TRUE " })).toThrow(/TRUST_PROXY=true is not allowed/);
  });
});
