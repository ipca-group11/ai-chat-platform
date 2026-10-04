/** Email ownership (AICHAT-253, pentest H1): registration sends a token, the token verifies the
 * address, and only then do access tokens say `email_verified: true`. */
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EMAIL_VERIFICATION_TTL_SECONDS } from "../shared/contracts/auth.js";
import { buildTestApp } from "../test-utils/build-test-app.js";
import { fakePrisma } from "../test-utils/fake-prisma.js";
import { cookieNamed, loginVia, registerVia } from "../test-utils/session-helpers.js";

afterEach(() => {
  vi.useRealTimers();
});

function emailVerifiedClaim(setCookie: string[]): unknown {
  const token = cookieNamed(setCookie, "access_token").slice("access_token=".length);
  return (jwt.decode(token) as { email_verified?: unknown }).email_verified;
}

describe("registration", () => {
  it("sends a 64-hex-character token for the new address and stores only its hash", async () => {
    const { app, prisma, mailer } = buildTestApp();
    const user = await registerVia(app, "ana@example.com");

    expect(mailer.sent).toHaveLength(1);
    expect(mailer.sent[0]).toMatchObject({ userId: user.id, email: "ana@example.com" });
    const token = mailer.tokenFor("ana@example.com");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    const stored = prisma.emailVerificationToken.create.mock.calls[0]?.[0].data;
    expect(stored?.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.tokenHash).not.toBe(token);
  });

  it("an unverified account signs in, but its access token says email_verified: false", async () => {
    const { app } = buildTestApp();
    await registerVia(app, "ana@example.com");
    expect(emailVerifiedClaim(await loginVia(app, "ana@example.com"))).toBe(false);
  });

  it("still creates the account when the mailer fails (the user can ask for a new token)", async () => {
    const { app, mailer } = buildTestApp();
    vi.spyOn(mailer, "sendEmailVerification").mockRejectedValueOnce(new Error("smtp down"));
    const res = await request(app).post("/auth/register").send({ email: "ana@example.com", password: "password1" });
    expect(res.status).toBe(201);
  });
});

describe("POST /auth/verify-email", () => {
  it("POST /auth/verify-email · 204 verifies the address; the next token says email_verified: true", async () => {
    const { app, mailer } = buildTestApp();
    await registerVia(app, "ana@example.com");
    const session = await loginVia(app, "ana@example.com");

    const res = await request(app).post("/auth/verify-email").send({ token: mailer.tokenFor("ana@example.com") });
    expect(res.status).toBe(204);

    // The access token already issued keeps its claim until it is refreshed.
    const refreshed = await request(app).post("/auth/refresh").set("Cookie", cookieNamed(session, "refresh_token"));
    expect(refreshed.status).toBe(204);
    expect(emailVerifiedClaim(refreshed.headers["set-cookie"] as unknown as string[])).toBe(true);
    expect(emailVerifiedClaim(await loginVia(app, "ana@example.com"))).toBe(true);

    const me = await request(app).get("/auth/me").set("Cookie", cookieNamed(await loginVia(app, "ana@example.com"), "access_token"));
    expect(me.body.emailVerified).toBe(true);
  });

  it("a token works once: a second use is 400", async () => {
    const { app, mailer } = buildTestApp();
    await registerVia(app, "ana@example.com");
    const token = mailer.tokenFor("ana@example.com");
    expect((await request(app).post("/auth/verify-email").send({ token })).status).toBe(204);

    const again = await request(app).post("/auth/verify-email").send({ token });
    expect(again.status).toBe(400);
    expect(again.body.error.code).toBe("INVALID_VERIFICATION_TOKEN");
  });

  it("400 INVALID_VERIFICATION_TOKEN for an unknown, malformed or missing token", async () => {
    const { app } = buildTestApp();
    for (const body of [{ token: "a".repeat(64) }, { token: "not-hex" }, { token: "A".repeat(64) }, {}]) {
      const res = await request(app).post("/auth/verify-email").send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe("INVALID_VERIFICATION_TOKEN");
    }
  });

  it("400 once the token is older than 24 hours, and the account stays unverified", async () => {
    const { app, mailer } = buildTestApp();
    await registerVia(app, "ana@example.com");
    const token = mailer.tokenFor("ana@example.com");

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + (EMAIL_VERIFICATION_TTL_SECONDS + 1) * 1000);
    expect((await request(app).post("/auth/verify-email").send({ token })).status).toBe(400);
    vi.useRealTimers();

    expect(emailVerifiedClaim(await loginVia(app, "ana@example.com"))).toBe(false);
  });

  it("a token verifies only the account it was sent to", async () => {
    const { app, mailer } = buildTestApp();
    await registerVia(app, "ana@example.com");
    await registerVia(app, "bob@example.com");
    await request(app).post("/auth/verify-email").send({ token: mailer.tokenFor("bob@example.com") });

    expect(emailVerifiedClaim(await loginVia(app, "ana@example.com"))).toBe(false);
    expect(emailVerifiedClaim(await loginVia(app, "bob@example.com"))).toBe(true);
  });
});

describe("POST /auth/verify-email/resend", () => {
  it("POST /auth/verify-email/resend · 204 sends a new token and the previous one stops working", async () => {
    const { app, prisma, mailer } = buildTestApp();
    const user = await registerVia(app, "ana@example.com");
    const first = mailer.tokenFor("ana@example.com");
    const access = cookieNamed(await loginVia(app, "ana@example.com"), "access_token");

    const res = await request(app).post("/auth/verify-email/resend").set("Cookie", access);
    expect(res.status).toBe(204);
    const second = mailer.tokenFor("ana@example.com");
    expect(second).not.toBe(first);
    expect(prisma.__verificationTokenCount(user.id)).toBe(1);

    expect((await request(app).post("/auth/verify-email").send({ token: first })).status).toBe(400);
    expect((await request(app).post("/auth/verify-email").send({ token: second })).status).toBe(204);
    expect(prisma.__verificationTokenCount(user.id)).toBe(0);
  });

  it("401 without a session", async () => {
    const { app } = buildTestApp();
    expect((await request(app).post("/auth/verify-email/resend")).status).toBe(401);
  });

  it("401 when the account behind the session no longer exists", async () => {
    const { app, prisma } = buildTestApp();
    const user = await registerVia(app, "ana@example.com");
    const access = cookieNamed(await loginVia(app, "ana@example.com"), "access_token");
    prisma.__removeUser(user.id);
    expect((await request(app).post("/auth/verify-email/resend").set("Cookie", access)).status).toBe(401);
  });

  it("409 EMAIL_ALREADY_VERIFIED once verified, and nothing is sent", async () => {
    const { app, mailer } = buildTestApp();
    await registerVia(app, "ana@example.com");
    await request(app).post("/auth/verify-email").send({ token: mailer.tokenFor("ana@example.com") });
    const access = cookieNamed(await loginVia(app, "ana@example.com"), "access_token");

    const res = await request(app).post("/auth/verify-email/resend").set("Cookie", access);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_VERIFIED");
    expect(mailer.sent).toHaveLength(1);
  });

  it("429 after the hourly resend limit", async () => {
    const { app } = buildTestApp(fakePrisma(), { resendsPerHour: 2 });
    await registerVia(app, "ana@example.com");
    const access = cookieNamed(await loginVia(app, "ana@example.com"), "access_token");
    const resend = () => request(app).post("/auth/verify-email/resend").set("Cookie", access);

    expect((await resend()).status).toBe(204);
    expect((await resend()).status).toBe(204);
    expect((await resend()).status).toBe(429);
  });
});
