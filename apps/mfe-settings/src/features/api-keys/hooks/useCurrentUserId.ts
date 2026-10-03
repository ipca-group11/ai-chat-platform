import { useQuery } from "@tanstack/react-query";
import { fetchCurrentUser } from "../api/auth";

/**
 * Resolves the current user's id for namespacing stored API keys (AC-78, AC-80). Not
 * retried automatically — an unauthenticated user simply sees `userId: undefined`
 * (the settings page is expected to be reached only via the shell's auth guard, per
 * `docs/pods/configuration/PLAN.md` cross-pod dependencies).
 */
export function useCurrentUserId() {
  const query = useQuery({
    queryKey: ["settings", "auth", "me"],
    queryFn: fetchCurrentUser,
    retry: false,
  });

  return {
    userId: query.data?.id,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
