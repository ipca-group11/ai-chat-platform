import { useState } from 'react';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { within } from '@testing-library/dom';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { RequireAuth } from './RequireAuth';

type SessionState = 'checking' | 'signed-in' | 'signed-out';

const USER = { id: '3f2b8c1e-9a4d-4e6f-8b7a-1c2d3e4f5a6b', email: 'ana@example.com' };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Answers `GET /auth/me` the way auth-service does for `parameters.session`; while checking,
 * and for anything else, the request stays pending rather than reaching a real server.
 */
function withFakeAuthService({ parameters }: { parameters: { session?: SessionState } }) {
  const session = parameters.session ?? 'checking';
  const realFetch = window.fetch;
  window.fetch = (input) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const { pathname } = new URL(href, window.location.href);
    if (pathname === '/auth/me' && session === 'signed-in') return Promise.resolve(json(USER));
    if (pathname === '/auth/me' && session === 'signed-out') {
      return Promise.resolve(json({ error: { code: 'UNAUTHENTICATED', message: 'Not authenticated' } }, 401));
    }
    return new Promise<Response>(() => undefined);
  };
  return () => {
    window.fetch = realFetch;
  };
}

/**
 * The guard reads the session through `useSession` and redirects with the router. Each story
 * gets its own QueryClient (not the shell's singleton) and an in-memory router with the
 * guarded `/settings` route and a stand-in `/login` page that shows where it would return to.
 */
const WithSessionAndRouter: Decorator = (Story) => {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
  );

  const [router] = useState(() => {
    const rootRoute = createRootRoute();
    const guarded = createRoute({
      getParentRoute: () => rootRoute,
      path: '/settings',
      component: () => <Story />,
    });
    const login = createRoute({
      getParentRoute: () => rootRoute,
      path: '/login',
      validateSearch: (search: Record<string, unknown>) => ({
        redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
      }),
      component: function LoginStandIn() {
        const { redirect } = login.useSearch();
        return (
          <div className="mx-auto w-full max-w-md px-4 py-10">
            <p className="text-sm font-medium">Sign-in page</p>
            <p className="text-sm text-muted-foreground">After signing in you return to {redirect}</p>
          </div>
        );
      },
    });
    return createRouter({
      routeTree: rootRoute.addChildren([guarded, login]),
      history: createMemoryHistory({ initialEntries: ['/settings'] }),
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
};

const meta = {
  title: 'App/Shell/RequireAuth',
  component: RequireAuth,
  tags: ['autodocs'],
  decorators: [WithSessionAndRouter],
  parameters: { layout: 'fullscreen' },
  beforeEach: withFakeAuthService,
  args: {
    children: (
      <div className="px-4 py-6 sm:px-6">
        <p className="text-sm">Protected settings content.</p>
      </div>
    ),
  },
} satisfies Meta<typeof RequireAuth>;
export default meta;

type Story = StoryObj<typeof meta>;

/** `GET /auth/me` has not answered yet: nothing is rendered, so no protected content flashes. */
export const CheckingSession: Story = {
  parameters: { session: 'checking' },
};

/** Signed in: the guarded page is shown. */
export const SignedIn: Story = {
  parameters: { session: 'signed-in' },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Protected settings content.', {}, { timeout: 5000 });
  },
};

/** Signed out: the guard redirects to `/login`, keeping `/settings` to return to afterwards. */
export const SignedOut: Story = {
  parameters: { session: 'signed-out' },
  play: async ({ canvasElement }) => {
    await within(canvasElement).findByText('Sign-in page', {}, { timeout: 5000 });
  },
};
