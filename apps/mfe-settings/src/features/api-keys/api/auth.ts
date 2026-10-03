import { CORRELATION_HEADER, generateCorrelationId } from "../../../shared/correlation";

/**
 * Minimal shape this app needs from `GET /auth/me` (owned by `auth-service`, `auth`
 * pod). Kept local rather than depending on a not-yet-published `packages/shared-types`
 * auth DTO — only the fields actually used here.
 */
export interface CurrentUser {
  id: string;
  email: string;
}

const AUTH_SERVICE_BASE_URL: string =
  (import.meta.env?.VITE_AUTH_SERVICE_URL as string | undefined) ?? "";

export class AuthError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}

/**
 * Resolves the currently logged-in user so stored API keys can be namespaced by
 * `userId` (AC-78, AC-80). Sends the httpOnly session cookie (`credentials: 'include'`)
 * rather than any bearer token, per `docs/ARCHITECTURE.md` §4.
 */
export async function fetchCurrentUser(): Promise<CurrentUser> {
  const response = await fetch(`${AUTH_SERVICE_BASE_URL}/auth/me`, {
    method: "GET",
    credentials: "include",
    headers: {
      [CORRELATION_HEADER]: generateCorrelationId(),
    },
  });

  if (!response.ok) {
    throw new AuthError(response.status, response.statusText || "Failed to load current user");
  }

  return (await response.json()) as CurrentUser;
}
