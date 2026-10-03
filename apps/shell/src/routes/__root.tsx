import { QueryClientProvider } from '@tanstack/react-query';
import { Outlet, createRootRoute } from '@tanstack/react-router';
import { queryClient } from '../app/queryClient';
import { AppShellLayout } from '../shared/layout';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShellLayout>
        <Outlet />
      </AppShellLayout>
    </QueryClientProvider>
  );
}
