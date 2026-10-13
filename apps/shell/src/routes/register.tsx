import { createFileRoute } from '@tanstack/react-router';
import { createRemoteRoute, reloadRemote } from '../features/remote-loader';

const RemoteAuthRoutes = createRemoteRoute(
  'auth',
  () => import('mfeAuth/routes'),
  (attempt) => reloadRemote('mfeAuth/routes', attempt),
);

function RegisterRoute() {
  return <RemoteAuthRoutes />;
}

export const Route = createFileRoute('/register')({
  component: RegisterRoute,
});
