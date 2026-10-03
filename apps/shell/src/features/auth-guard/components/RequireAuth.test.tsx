import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { RequireAuth } from './components/RequireAuth';
import * as apiClientModule from '../../shared/http/apiClient';

/**
 * Builds a tiny router (protected route + `/login`) so `RequireAuth`'s
 * `useNavigate`/`useRouterState` calls have real router context to work
 * against, without pulling in the whole shell's route tree.
 */
function renderWithRouter(initialPath: string, queryClient: QueryClient) {
  const rootRoute = createRootRoute();

  const protectedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/protected',
    component: () => (
      <RequireAuth>
        <div>Protected content</div>
      </RequireAuth>
    ),
  });

  const loginRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/login',
    validateSearch: (search: Record<string, unknown>) => ({
      redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
    }),
    component: function LoginComponent() {
      const search = loginRoute.useSearch();
      return <div>Login page{search.redirect ? ` redirect=${search.redirect}` : ''}</div>;
    },
  });

  const routeTree = rootRoute.addChildren([protectedRoute, loginRoute]);
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe('RequireAuth', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('AC-25/AC-26: renders children once the session query resolves authenticated', async () => {
    vi.spyOn(apiClientModule, 'apiFetch').mockResolvedValue({
      user: { userId: 'u1', email: 'a@example.com' },
    });

    renderWithRouter('/protected', createTestQueryClient());

    expect(await screen.findByText('Protected content')).toBeInTheDocument();
  });

  it('AC-26: redirects to /login (preserving the intended URL) when unauthenticated', async () => {
    vi.spyOn(apiClientModule, 'apiFetch').mockRejectedValue(
      new apiClientModule.ApiError('Unauthorized', 401),
    );

    renderWithRouter('/protected', createTestQueryClient());

    await waitFor(() => {
      expect(screen.getByText(/Login page/)).toBeInTheDocument();
    });
    expect(screen.getByText(/redirect=/)).toHaveTextContent('/protected');
  });

  it('AC-26: an expired session (401 mid-session) is treated as unauthenticated and redirects to /login', async () => {
    // Simulates `useSession` refetching mid-session and getting a fresh 401
    // (e.g. the access token expired) rather than a network/server error.
    vi.spyOn(apiClientModule, 'apiFetch').mockRejectedValue(
      new apiClientModule.ApiError('Unauthorized', 401),
    );

    renderWithRouter('/protected', createTestQueryClient());

    await waitFor(() => {
      expect(screen.getByText(/Login page/)).toBeInTheDocument();
    });
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
});
