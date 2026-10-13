import { createFileRoute } from '@tanstack/react-router';
import { createRemoteRoute, reloadRemote } from '../features/remote-loader';

const RemoteAuthRoutes = createRemoteRoute(
  'auth',
  () => import('mfeAuth/routes'),
  (attempt) => reloadRemote('mfeAuth/routes', attempt),
);

interface LoginSearch {
  /** URL to return to after a successful login, set by `RequireAuth`. */
  redirect?: string;
}

function LoginRoute() {
  return <RemoteAuthRoutes />;
}

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  component: LoginRoute,
});
