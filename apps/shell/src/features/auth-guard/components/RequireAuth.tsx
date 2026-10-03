import { useEffect, useRef, type ReactNode } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { useSession } from '../api/useSession';

export interface RequireAuthProps {
  children: ReactNode;
}

/**
 * Route guard used by protected routes (`/chats`, `/settings`).
 *
 * Renders `children` once the session query resolves authenticated. While
 * loading, renders nothing (avoids a flash of protected content). Once
 * resolved unauthenticated — including a 401 that arrives mid-session, which
 * `useSession` also reports as `isAuthenticated: false` — it redirects to
 * `/login`, preserving the current URL as a `redirect` search param so the
 * caller can return the user to where they started after login.
 */
export function RequireAuth({ children }: RequireAuthProps) {
  const { isLoading, isAuthenticated } = useSession();
  const navigate = useNavigate();
  const currentHref = useRouterState({
    select: (state) => state.location.href,
  });

  // Tracked via a ref (rather than a `useEffect` dependency) so that once the
  // redirect navigation itself updates `currentHref` (e.g. to `/login`), it
  // does not re-trigger this effect and cause a runaway chain of nested
  // `redirect` search params. The ref is synced in its own effect (never
  // written during render) so it always holds the latest value by the time
  // the redirect effect below reads it.
  const currentHrefRef = useRef(currentHref);
  useEffect(() => {
    currentHrefRef.current = currentHref;
  }, [currentHref]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      void navigate({
        to: '/login',
        search: { redirect: currentHrefRef.current },
      });
    }
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading || !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
