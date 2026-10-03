import { useQuery } from "@tanstack/react-query";
import { apiFetch, ApiError } from "../../../shared/api-client";

export interface SessionUser {
  id: string;
  email: string;
}

// GET /auth/me — contract owned by `services/auth-service` (PLAN.md B3). Returns the
// current user when the access token cookie is valid, else the server responds 401.
export function fetchMe(): Promise<SessionUser> {
  return apiFetch<SessionUser>("/auth/me", { method: "GET" });
}

// POST /auth/refresh — rotates the refresh token and issues a new access token cookie
// (PLAN.md B3). Resolves with no body; the new cookies are set by the server.
export function refreshSession(): Promise<void> {
  return apiFetch<void>("/auth/refresh", { method: "POST" });
}

/**
 * Session-check primitive for the shell's auth guard (PLAN.md F4, AC-41 contract).
 *
 * Calls `GET /auth/me`; if that fails with a 401 (expired/invalid access token), attempts
 * one silent refresh via `POST /auth/refresh` and retries `/auth/me` exactly once. If the
 * retry also fails, the resulting `ApiError` (401) propagates so the caller (the shell's
 * guard, or `useSession` below) can treat it as "not authenticated" and redirect to
 * `/login`. Any non-401 error is rethrown immediately without attempting a refresh.
 */
export async function fetchSessionWithRefresh(): Promise<SessionUser> {
  try {
    return await fetchMe();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await refreshSession();
      return await fetchMe();
    }
    throw error;
  }
}

export function useSession() {
  return useQuery({
    queryKey: ["session", "me"],
    queryFn: fetchSessionWithRefresh,
    retry: false,
  });
}
