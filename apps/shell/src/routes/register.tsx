import { createFileRoute } from '@tanstack/react-router';
import { createRemoteRoute } from '../features/remote-loader';

const RemoteAuthRoutes = createRemoteRoute('auth', () => import('mfeAuth/routes'));

function RegisterRoute() {
  return <RemoteAuthRoutes />;
}

export const Route = createFileRoute('/register')({
  component: RegisterRoute,
});
