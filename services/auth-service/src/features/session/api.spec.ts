import cookieParser from "cookie-parser";
import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { fakePrisma } from "./test-fakes.js";
import { makeUser } from "./test-fakes.js";

vi.mock("../../shared/prisma", async () => {
  const { fakePrisma: buildFakePrisma } = await import("./test-fakes");
  return { prisma: buildFakePrisma() };
});

const { sessionRouter } = await import("./api");
const { errorMiddleware } = await import("../../shared/error-middleware");
const { correlationIdMiddleware } = await import("../../shared/correlation-id");
const { prisma } = (await import("../../shared/prisma")) as unknown as {
  prisma: ReturnType<typeof fakePrisma>;
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(correlationIdMiddleware);
  app.use("/auth", sessionRouter);
  app.use(errorMiddleware);
  return app;
}

function extractCookie(setCookieHeader: string[], name: string): string | undefined {
  return setCookieHeader.find((c) => c.startsWith(`${name}=`));
}

describe("session routes", () => {
  beforeEach(() => {
    prisma.user.findUnique.mockClear();
    prisma.refreshToken.findUnique.mockClear();
    prisma.refreshToken.create.mockClear();
    prisma.refreshToken.update.mockClear();
  });

  describe("POST /auth/login", () => {
    it("AC-35: valid credentials log in and return the user's public profile", async () => {
      const user = await makeUser("login-ok@example.com", "password1");
      prisma.__addUser(user);

      const res = await request(buildApp())
        .post("/auth/login")
        .send({ email: "login-ok@example.com", password: "password1" });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: user.id, email: user.email });
    });

    it("AC-37: sets access_token and refresh_token as httpOnly, Secure, SameSite=Lax cookies", async () => {
      const user = await makeUser("cookies@example.com", "password1");
      prisma.__addUser(user);

      const res = await request(buildApp())
        .post("/auth/login")
        .send({ email: "cookies@example.com", password: "password1" });

      const setCookie = res.headers["set-cookie"] as unknown as string[];
      const access = extractCookie(setCookie, "access_token");
      const refresh = extractCookie(setCookie, "refresh_token");

      expect(access).toBeTruthy();
      expect(access).toMatch(/HttpOnly/i);
      expect(access).toMatch(/Secure/i);
      expect(access).toMatch(/SameSite=Lax/i);

      expect(refresh).toBeTruthy();
      expect(refresh).toMatch(/HttpOnly/i);
      expect(refresh).toMatch(/Secure/i);
      expect(refresh).toMatch(/SameSite=Lax/i);
      expect(refresh).toMatch(/Path=\/auth/i);
    });

    it("AC-36: an unknown email returns the generic invalid-credentials error (401)", async () => {
      const res = await request(buildApp())
        .post("/auth/login")
        .send({ email: "nobody@example.com", password: "password1" });

      expect(res.status).toBe(401);
      expect(res.body.error.message).toBe("Invalid email or password");
    });

    it("AC-36: a wrong password returns the identical status/message as an unknown email", async () => {
      const user = await makeUser("wrongpw@example.com", "correct-password1");
      prisma.__addUser(user);

      const res = await request(buildApp())
        .post("/auth/login")
        .send({ email: "wrongpw@example.com", password: "incorrect-password1" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
      expect(res.body.error.message).toBe("Invalid email or password");
    });
  });

  describe("POST /auth/refresh", () => {
    it("rotates the refresh token and issues new cookies", async () => {
      const user = await makeUser("refresh@example.com", "password1");
      prisma.__addUser(user);
      const loginRes = await request(buildApp())
        .post("/auth/login")
        .send({ email: "refresh@example.com", password: "password1" });
      const refreshCookie = extractCookie(
        loginRes.headers["set-cookie"] as unknown as string[],
        "refresh_token",
      ) as string;

      const res = await request(buildApp())
        .post("/auth/refresh")
        .set("Cookie", refreshCookie);

      expect(res.status).toBe(204);
      const newSetCookie = res.headers["set-cookie"] as unknown as string[];
      expect(extractCookie(newSetCookie, "access_token")).toBeTruthy();
      expect(extractCookie(newSetCookie, "refresh_token")).toBeTruthy();
    });

    it("rejects a missing refresh cookie", async () => {
      const res = await request(buildApp()).post("/auth/refresh");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_REFRESH_TOKEN");
    });

    it("rejects a reused/rotated-out refresh token", async () => {
      const user = await makeUser("reuse2@example.com", "password1");
      prisma.__addUser(user);
      const loginRes = await request(buildApp())
        .post("/auth/login")
        .send({ email: "reuse2@example.com", password: "password1" });
      const refreshCookie = extractCookie(
        loginRes.headers["set-cookie"] as unknown as string[],
        "refresh_token",
      ) as string;

      await request(buildApp()).post("/auth/refresh").set("Cookie", refreshCookie);
      const secondUse = await request(buildApp()).post("/auth/refresh").set("Cookie", refreshCookie);

      expect(secondUse.status).toBe(401);
      expect(secondUse.body.error.code).toBe("INVALID_REFRESH_TOKEN");
    });
  });

  describe("POST /auth/logout and GET /auth/me", () => {
    it("AC-38: logout revokes the refresh token and clears both cookies", async () => {
      const user = await makeUser("logout@example.com", "password1");
      prisma.__addUser(user);
      const loginRes = await request(buildApp())
        .post("/auth/login")
        .send({ email: "logout@example.com", password: "password1" });
      const setCookie = loginRes.headers["set-cookie"] as unknown as string[];
      const refreshCookie = extractCookie(setCookie, "refresh_token") as string;
      const accessCookie = extractCookie(setCookie, "access_token") as string;

      const logoutRes = await request(buildApp())
        .post("/auth/logout")
        .set("Cookie", [refreshCookie, accessCookie]);

      expect(logoutRes.status).toBe(204);
      const clearedCookies = logoutRes.headers["set-cookie"] as unknown as string[];
      expect(clearedCookies.some((c) => c.startsWith("access_token=;"))).toBe(true);
      expect(clearedCookies.some((c) => c.startsWith("refresh_token=;"))).toBe(true);

      // A subsequent refresh with the now-revoked token is rejected.
      const refreshAfterLogout = await request(buildApp())
        .post("/auth/refresh")
        .set("Cookie", refreshCookie);
      expect(refreshAfterLogout.status).toBe(401);
    });

    it("AC-35: GET /auth/me returns the current user when the access token cookie is valid", async () => {
      const user = await makeUser("me@example.com", "password1");
      prisma.__addUser(user);
      const loginRes = await request(buildApp())
        .post("/auth/login")
        .send({ email: "me@example.com", password: "password1" });
      const accessCookie = extractCookie(
        loginRes.headers["set-cookie"] as unknown as string[],
        "access_token",
      ) as string;

      const res = await request(buildApp()).get("/auth/me").set("Cookie", accessCookie);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: user.id, email: user.email });
    });

    it("AC-38: GET /auth/me is 401 after logout (access cookie cleared client-side / no cookie sent)", async () => {
      const res = await request(buildApp()).get("/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    });

    it("GET /auth/me is 401 with a garbage access token cookie", async () => {
      const res = await request(buildApp()).get("/auth/me").set("Cookie", "access_token=garbage");
      expect(res.status).toBe(401);
    });
  });
});
