import { useQuery } from '@tanstack/react-query';
import { apiFetch, isUnauthorizedError } from '../../../shared/http/apiClient';
import type { AuthMeResponse, Session } from '../model/session';

const SESSION_QUERY_KEY = ['auth', 'me'] as const;

/** `GET /auth/me`: the current user, or `null` when auth-service answers 401. */
export async function fetchSession(): Promise<Session | null> {
  try {
    const response = await apiFetch<AuthMeResponse | Session>('/auth/me');
    // auth-service returns the user itself ({ id, email }); the shell's type wrapped it in { user }.
    return 'user' in response ? response.user : response;
  } catch (error) {
    // A 401 means "not authenticated" — a normal, expected state — not a
    // query error, so we resolve to `null` rather than rejecting.
    if (isUnauthorizedError(error)) {
      return null;
    }
    throw error;
  }
}

export interface UseSessionResult {
  data: Session | undefined;
  isLoading: boolean;
  isAuthenticated: boolean;
}

/**
 * Queries `GET /auth/me` (via `auth-service`) for the current session.
 *
 * A 401 response is treated as "not authenticated" (`isAuthenticated: false`)
 * rather than surfaced as a query error, so consumers like `RequireAuth` can
 * branch on `isAuthenticated` without special-casing error state.
 */
export function useSession(): UseSessionResult {
  const query = useQuery({
    queryKey: SESSION_QUERY_KEY,
    queryFn: fetchSession,
    // A login happens in the auth remote: re-check the session whenever a guarded page mounts.
    refetchOnMount: 'always',
  });

  return {
    data: query.data ?? undefined,
    // Wait for the re-check instead of redirecting on a stale "not signed in".
    isLoading: query.isLoading || (query.isFetching && !query.data),
    isAuthenticated: Boolean(query.data),
  };
}

export { SESSION_QUERY_KEY };
