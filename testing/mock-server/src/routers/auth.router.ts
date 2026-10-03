import { Router, type Response } from "express";
import { auth } from "@app/shared-types";
import { z } from "zod";
import { accessTokenOf, currentUser, sessionsFor } from "../auth/sessions.js";
import { jsonBody } from "../core/request-log.js";
import { cors, errorHandler, HttpError, parseCookies } from "../backend/http.js";
import { faultInjector, FAULT_SCENARIOS } from "../faults/faults.js";
import type { MockContext, MockModule } from "../registry.js";

const FAULT_DESCRIPTIONS = {
  "session-expired": "401 UNAUTHENTICATED and the session cookies cleared",
  "error-500": "500 INTERNAL_ERROR",
  slow: "Answer is held back (3 s, or delayMs of the fault)",
} as const;

const REFRESH_PATH = "/auth";

const cookieOptions = { httpOnly: true, sameSite: "lax", secure: false } as const;

function setSessionCookies(res: Response, token: string): void {
  res.cookie(auth.ACCESS_TOKEN_COOKIE, token, {
    ...cookieOptions,
    path: "/",
    maxAge: auth.ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
  res.cookie(auth.REFRESH_TOKEN_COOKIE, token, {
    ...cookieOptions,
    path: REFRESH_PATH,
    maxAge: auth.REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie(auth.ACCESS_TOKEN_COOKIE, { ...cookieOptions, path: "/" });
  res.clearCookie(auth.REFRESH_TOKEN_COOKIE, { ...cookieOptions, path: REFRESH_PATH });
}

function nextUserId(ctx: MockContext): string {
  const taken = new Set(ctx.store.data.users.map((user) => user.id));
  let n = ctx.store.data.users.length + 1;
  while (taken.has(`user_${String(n).padStart(5, "0")}`)) n += 1;
  return `user_${String(n).padStart(5, "0")}`;
}

/** auth-service mock: `/auth/register`, `/login`, `/refresh`, `/logout`, `/me` with the session in cookies. */
function createAuthRouter(ctx: MockContext): Router {
  const router = Router();
  const sessions = sessionsFor(ctx);

  router.use(cors);
  router.use(
    faultInjector(ctx, {
      unauthenticated: "Not authenticated",
      internal: "Internal server error",
      onSessionExpired: clearSessionCookies,
    }),
  );
  router.use(jsonBody());

  router.post("/register", (req, res) => {
    const parsed = auth.registerRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      const fieldErrors = z.flattenError(parsed.error).fieldErrors as Record<string, string[]>;
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid registration details", fieldErrors);
    }
    const { email, password } = parsed.data;
    if (ctx.store.data.users.some((user) => user.email === email)) {
      throw new HttpError(409, "EMAIL_TAKEN", "An account with this email already exists", {
        email: ["An account with this email already exists"],
      });
    }
    const user = { id: nextUserId(ctx), email, password, createdAt: new Date().toISOString() };
    ctx.store.data.users.push(user);
    res.status(201).json({ id: user.id, email: user.email });
  });

  router.post("/login", (req, res) => {
    const invalid = () => new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    const parsed = auth.loginRequestSchema.safeParse(req.body);
    if (!parsed.success) throw invalid();
    const user = ctx.store.data.users.find((candidate) => candidate.email === parsed.data.email);
    if (!user || user.password !== parsed.data.password) throw invalid();
    setSessionCookies(res, sessions.open(user.id));
    res.status(200).json({ id: user.id, email: user.email });
  });

  router.post("/refresh", (req, res) => {
    const presented = parseCookies(req.headers.cookie)[auth.REFRESH_TOKEN_COOKIE];
    const userId = sessions.userIdOf(presented);
    if (!presented || !userId) {
      throw new HttpError(401, "INVALID_REFRESH_TOKEN", "Invalid or expired refresh token");
    }
    sessions.close(presented);
    setSessionCookies(res, sessions.open(userId));
    res.status(204).end();
  });

  router.post("/logout", (req, res) => {
    sessions.close(parseCookies(req.headers.cookie)[auth.REFRESH_TOKEN_COOKIE]);
    sessions.close(accessTokenOf(req));
    clearSessionCookies(res);
    res.status(204).end();
  });

  router.get("/me", (req, res) => {
    const user = currentUser(ctx, req);
    if (!user) throw new HttpError(401, "UNAUTHENTICATED", "Not authenticated");
    res.status(200).json({ id: user.id, email: user.email });
  });

  router.use((_req, _res, next) => {
    next(new HttpError(404, "NOT_FOUND", "Not found"));
  });
  router.use(errorHandler("Internal server error"));
  return router;
}

/** auth-service mock. Seeded users sign in with the dataset password (`MOCK_PASSWORD`). */
export const authMock: MockModule = {
  name: "auth",
  mountPath: "/auth",
  scenarios: FAULT_SCENARIOS.filter((name) => name !== "stream-drop").map((name) => ({
    mock: "auth",
    name,
    description: FAULT_DESCRIPTIONS[name],
  })),
  createRouter: createAuthRouter,
};
