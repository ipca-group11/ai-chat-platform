/**
 * Logs the user out (AC-38 frontend half): revokes the session server-side, clears every
 * cached TanStack Query result so no previously-fetched data for the old session can leak
 * to whoever uses the app next, then redirects to `/login`.
 */
export declare function useLogout(): import("@tanstack/react-query").UseMutationResult<void, Error, void, unknown>;
