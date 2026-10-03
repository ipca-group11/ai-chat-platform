import { CORRELATION_HEADER } from "./types";

/** Minimal shape this app needs from auth-service's `GET /auth/me`. */
export interface CurrentUser {
  id: string;
  email: string;
}

const AUTH_SERVICE_BASE_URL: string =
  (import.meta.env?.VITE_AUTH_SERVICE_URL as string | undefined) ?? "";

/**
 * Resolves the signed-in user through the httpOnly session cookie. Same-origin by
 * default (the shell proxies `/auth` to auth-service).
 */
export async function fetchCurrentUser(): Promise<CurrentUser> {
  const res = await fetch(`${AUTH_SERVICE_BASE_URL}/auth/me`, {
    credentials: "include",
    headers: { [CORRELATION_HEADER]: crypto.randomUUID() },
  });
  if (!res.ok) throw new Error(`GET /auth/me failed with ${res.status}`);
  const body = (await res.json()) as CurrentUser | { user: CurrentUser };
  return "user" in body ? body.user : body;
}
