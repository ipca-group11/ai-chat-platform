import type { ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { NavBar } from './NavBar';
import { queryClient } from '../../app/queryClient';
import { logout } from '../../features/auth-guard/api/logout';
import { SESSION_QUERY_KEY, useSession } from '../../features/auth-guard/api/useSession';

export interface AppShellLayoutProps {
  children: ReactNode;
}

/**
 * Root layout: nav + routed content. Wrapping this (and the whole tree) in
 * `QueryClientProvider` happens one level up, in `routes/__root.tsx`, so the
 * same client instance is available to `useSession` here and to any remote
 * that reuses it as a federation-shared singleton (AC-25).
 */
export function AppShellLayout({ children }: AppShellLayoutProps) {
  const navigate = useNavigate();
  const { data: session } = useSession();

  const handleLogout = () => {
    void logout()
      .catch(() => {
        // Best-effort: even if the network call fails, clear local session
        // state and send the user back to the login screen.
      })
      .finally(() => {
        queryClient.setQueryData(SESSION_QUERY_KEY, null);
        void navigate({ to: '/login' });
      });
  };

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <NavBar userEmail={session?.email} onLogout={handleLogout} />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
