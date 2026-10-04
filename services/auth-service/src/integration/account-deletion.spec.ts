/** DELETE /auth/me: account deletion with cross-service erasure (AICHAT-79). */
import request from "supertest";
import { describe, expect, it, vi } from "vitest";
import type { ErasureClient } from "../shared/erasure-client.js";
import { buildTestApp } from "../test-utils/build-test-app.js";
import { loginVia, PASSWORD, registerVia } from "../test-utils/session-helpers.js";

function fakeErasure() {
  const calls: Array<{ userId: string; email: string }> = [];
  const client: ErasureClient & { failNext: boolean } = {
    failNext: false,
    eraseUser: vi.fn(async (userId: string, email: string) => {
      calls.push({ userId, email });
      if (client.failNext) throw new Error("conversation-service is down");
    }),
  };
  return { client, calls };
}

async function signedIn(options: Parameters<typeof buildTestApp>[1] = {}) {
  const t = buildTestApp(undefined, options);
  const user = await registerVia(t.app, "ana@example.com");
  const cookies = await loginVia(t.app, "ana@example.com");
  return { ...t, user, cookies };
}

describe("DELETE /auth/me", () => {
  it("DELETE /auth/me · 204 erases the conversation data first, then the account, and clears the cookies", async () => {
    const { client, calls } = fakeErasure();
    const { app, prisma, user, cookies } = await signedIn({ erasure: client });
    expect(prisma.__tokenCount(user.id)).toBe(1);

    const res = await request(app).delete("/auth/me").set("Cookie", cookies).send({ password: PASSWORD });

    expect(res.status).toBe(204);
    expect(calls).toEqual([{ userId: user.id, email: "ana@example.com" }]);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
    expect(prisma.__tokenCount(user.id)).toBe(0); // refresh tokens go with the user
    const cleared = (res.headers["set-cookie"] as unknown as string[]).join(";");
    expect(cleared).toMatch(/access_token=;/);
    expect(cleared).toMatch(/refresh_token=;/);
    // The order matters: erasure was asked before the row was deleted.
    const eraseOrder = vi.mocked(client.eraseUser).mock.invocationCallOrder[0] ?? 0;
    const deleteOrder = prisma.user.deleteMany.mock.invocationCallOrder[0] ?? 0;
    expect(eraseOrder).toBeLessThan(deleteOrder);
  });

  it("DELETE /auth/me · 502 and the user stays when conversation-service fails; a retry succeeds", async () => {
    const { client, calls } = fakeErasure();
    const { app, prisma, user, cookies } = await signedIn({ erasure: client });
    client.failNext = true;

    const failed = await request(app).delete("/auth/me").set("Cookie", cookies).send({ password: PASSWORD });

    expect(failed.status).toBe(502);
    expect(failed.body.error.code).toBe("ACCOUNT_DELETION_FAILED");
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
    expect(prisma.user.deleteMany).not.toHaveBeenCalled();

    client.failNext = false;
    const retried = await request(app).delete("/auth/me").set("Cookie", cookies).send({ password: PASSWORD });

    expect(retried.status).toBe(204);
    expect(calls).toHaveLength(2);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).toBeNull();
  });

  it("DELETE /auth/me · is idempotent: repeating it after the account is gone still answers 204", async () => {
    const { client, calls } = fakeErasure();
    const { app, cookies } = await signedIn({ erasure: client });

    await request(app).delete("/auth/me").set("Cookie", cookies).send({ password: PASSWORD }).expect(204);
    const again = await request(app).delete("/auth/me").set("Cookie", cookies).send({ password: PASSWORD });

    expect(again.status).toBe(204);
    expect(calls).toHaveLength(2); // the erasure is asked again, it is idempotent
  });

  it("DELETE /auth/me · 401 without a session", async () => {
    const { client, calls } = fakeErasure();
    const { app } = await signedIn({ erasure: client });

    const res = await request(app).delete("/auth/me").send({ password: PASSWORD });

    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("DELETE /auth/me · 401 for a wrong password and nothing is deleted", async () => {
    const { client, calls } = fakeErasure();
    const { app, prisma, user, cookies } = await signedIn({ erasure: client });

    const res = await request(app).delete("/auth/me").set("Cookie", cookies).send({ password: "not-my-password1" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(calls).toHaveLength(0);
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("DELETE /auth/me · 400 without a password", async () => {
    const { client, calls } = fakeErasure();
    const { app, cookies } = await signedIn({ erasure: client });

    const res = await request(app).delete("/auth/me").set("Cookie", cookies).send({});

    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it("DELETE /auth/me · 403 for a request that comes from another origin (CSRF)", async () => {
    const { client, calls } = fakeErasure();
    const { app, cookies } = await signedIn({ erasure: client });

    const res = await request(app).delete("/auth/me").set("Cookie", cookies).set("Origin", "https://evil.example").send({ password: PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN_ORIGIN");
    expect(calls).toHaveLength(0);
  });

  it("DELETE /auth/me · accepts the allowed origin", async () => {
    const { client } = fakeErasure();
    const { app, cookies } = await signedIn({ erasure: client });

    const res = await request(app).delete("/auth/me").set("Cookie", cookies).set("Origin", "http://localhost:3000").send({ password: PASSWORD });

    expect(res.status).toBe(204);
  });

  it("DELETE /auth/me · 503 and nothing deleted when erasure is not configured", async () => {
    const { app, prisma, user, cookies } = await signedIn();

    const res = await request(app).delete("/auth/me").set("Cookie", cookies).send({ password: PASSWORD });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("ACCOUNT_DELETION_UNAVAILABLE");
    expect(await prisma.user.findUnique({ where: { id: user.id } })).not.toBeNull();
  });

  it("DELETE /auth/me · is rate limited", async () => {
    const { client } = fakeErasure();
    const { app, cookies } = await signedIn({ erasure: client, deletionsPerHour: 2 });

    await request(app).delete("/auth/me").set("Cookie", cookies).send({ password: "wrong-password1" }).expect(401);
    await request(app).delete("/auth/me").set("Cookie", cookies).send({ password: "wrong-password1" }).expect(401);
    const limited = await request(app).delete("/auth/me").set("Cookie", cookies).send({ password: PASSWORD });

    expect(limited.status).toBe(429);
  });
});
