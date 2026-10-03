import { createFileRoute } from '@tanstack/react-router';
import { RequireAuth } from '../features/auth-guard';
import { createRemoteRoute } from '../features/remote-loader';

const RemoteSettingsRoutes = createRemoteRoute('settings', () => import('mfeSettings/routes'));

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
