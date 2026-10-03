/**
 * `access_token` / `refresh_token` cookie helpers (ARCHITECTURE.md §4). Both cookies are
 * `httpOnly`, `Secure` (per `COOKIE_SECURE` env — only relaxed for local plain-http dev),
 * `SameSite=Lax`. The refresh cookie is scoped to `/auth` (only sent to this service's
 * auth endpoints); the access cookie is scoped to `/` since other services/routes need
 * it attached.
 */
import type { CookieOptions, Response } from "express";
import { auth } from "../../shared/contracts/index.js";
import { env } from "../../shared/env.js";

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
  };
}

export function setAccessTokenCookie(res: Response, token: string): void {
  res.cookie(auth.ACCESS_TOKEN_COOKIE, token, {
    ...baseCookieOptions(),
    path: "/",
    maxAge: auth.ACCESS_TOKEN_TTL_SECONDS * 1000,
  });
}

export function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(auth.REFRESH_TOKEN_COOKIE, token, {
    ...baseCookieOptions(),
    path: "/auth",
    maxAge: auth.REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
): void {
  setAccessTokenCookie(res, tokens.accessToken);
  setRefreshTokenCookie(res, tokens.refreshToken);
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(auth.ACCESS_TOKEN_COOKIE, { ...baseCookieOptions(), path: "/" });
  res.clearCookie(auth.REFRESH_TOKEN_COOKIE, { ...baseCookieOptions(), path: "/auth" });
}
