export interface SessionUser {
    id: string;
    email: string;
}
export declare function fetchMe(): Promise<SessionUser>;
export declare function refreshSession(): Promise<void>;
/**
 * Session-check primitive for the shell's auth guard (PLAN.md F4, AC-41 contract).
 *
 * Calls `GET /auth/me`; if that fails with a 401 (expired/invalid access token), attempts
 * one silent refresh via `POST /auth/refresh` and retries `/auth/me` exactly once. If the
 * retry also fails, the resulting `ApiError` (401) propagates so the caller (the shell's
 * guard, or `useSession` below) can treat it as "not authenticated" and redirect to
 * `/login`. Any non-401 error is rethrown immediately without attempting a refresh.
 */
export declare function fetchSessionWithRefresh(): Promise<SessionUser>;
export declare function useSession(): import("@tanstack/react-query").UseQueryResult<SessionUser, Error>;
