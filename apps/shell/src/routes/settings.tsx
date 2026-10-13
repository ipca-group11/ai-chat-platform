import { createFileRoute } from '@tanstack/react-router';
import { RequireAuth } from '../features/auth-guard';
import { createRemoteRoute, reloadRemote } from '../features/remote-loader';

const RemoteSettingsRoutes = createRemoteRoute(
  'settings',
  () => import('mfeSettings/routes'),
  (attempt) => reloadRemote('mfeSettings/routes', attempt),
);

function SettingsRoute() {
  return (
    <RequireAuth>
      <RemoteSettingsRoutes />
    </RequireAuth>
  );
}

export const Route = createFileRoute('/settings')({
  component: SettingsRoute,
});
