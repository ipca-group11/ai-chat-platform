import { createContext, useContext, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, AlertDescription, Skeleton } from "@app/ui";
import { fetchCurrentUser } from "../shared/auth";

/**
 * The authenticated user's id. Provided either explicitly (standalone `mount()`, tests)
 * or resolved from the session by `CurrentUserGate` when the shell mounts this remote
 * behind its auth guard (see docs/ARCHITECTURE.md §4).
 */
const CurrentUserContext = createContext<string | null>(null);

export function CurrentUserProvider({ userId, children }: { userId: string; children: ReactNode }) {
  return <CurrentUserContext.Provider value={userId}>{children}</CurrentUserContext.Provider>;
}

/**
 * Renders `children` inside a `CurrentUserProvider`. Reuses an id provided higher up;
 * otherwise loads it from `GET /auth/me` (the shell's guard has already checked the
 * session, so this normally resolves immediately).
 */
export function CurrentUserGate({ children }: { children: ReactNode }) {
  const providedUserId = useContext(CurrentUserContext);
  const query = useQuery({
    queryKey: ["chat", "auth", "me"],
    queryFn: fetchCurrentUser,
    enabled: !providedUserId,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });

  if (providedUserId) return <>{children}</>;

  if (query.isError) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10">
        <Alert variant="destructive">
          <AlertDescription>Your session could not be verified. Please sign in again.</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!query.data) {
    return (
      <div className="flex flex-1 gap-4 p-4">
        <Skeleton className="hidden h-full w-72 md:block" />
        <Skeleton className="h-full flex-1" />
      </div>
    );
  }

  return <CurrentUserProvider userId={query.data.id}>{children}</CurrentUserProvider>;
}

export function useCurrentUserId(): string {
  const userId = useContext(CurrentUserContext);
  if (!userId) {
    throw new Error(
      "useCurrentUserId must be used within a CurrentUserProvider (or CurrentUserGate)."
    );
  }
  return userId;
}
