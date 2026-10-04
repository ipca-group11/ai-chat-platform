import { useState } from 'react';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { SESSION_QUERY_KEY } from '../../features/auth-guard/api/useSession';
import type { Session } from '../../features/auth-guard/model/session';
import { AppShellLayout } from './AppShellLayout';

/**
 * The layout reads the session through `useSession` and navigates with the router.
 * Each story gets its own QueryClient seeded with `parameters.session` (with the session
 * query disabled, so `GET /auth/me` is never sent) and an in-memory router.
 */
const WithSessionAndRouter: Decorator = (Story, context) => {
  const session = (context.parameters.session as Session | null | undefined) ?? null;
  const initialPath = (context.parameters.initialPath as string | undefined) ?? '/chats';

  const [queryClient] = useState(() => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryDefaults(SESSION_QUERY_KEY, { enabled: false });
    client.setQueryData(SESSION_QUERY_KEY, session);
    return client;
  });

  const [router] = useState(() => {
    const rootRoute = createRootRoute({ component: () => <Story /> });
    const destinations = ['/chats', '/settings', '/login'].map((path) =>
      createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
    );
    return createRouter({
      routeTree: rootRoute.addChildren(destinations),
      history: createMemoryHistory({ initialEntries: [initialPath] }),
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
};

const meta = {
  title: 'App/Shell/AppShellLayout',
  component: AppShellLayout,
  tags: ['autodocs'],
  decorators: [WithSessionAndRouter],
  parameters: { layout: 'fullscreen' },
  args: {
    children: (
      <div className="px-4 py-6 sm:px-6">
        <p className="text-sm text-muted-foreground">The routed microfrontend renders here.</p>
      </div>
    ),
  },
} satisfies Meta<typeof AppShellLayout>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Signed in: the nav shows the app links, the user's email and "Log out". */
export const SignedIn: Story = {
  parameters: { session: { userId: 'u1', email: 'ana@example.com' } satisfies Session },
};

/** Signed out (e.g. on /login): the nav shows only the brand and the theme toggle. */
export const SignedOut: Story = {
  parameters: { session: null, initialPath: '/login' },
};
