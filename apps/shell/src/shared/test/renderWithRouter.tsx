import type { ReactNode } from 'react';
import { render } from '@testing-library/react';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';

/**
 * Renders `ui` as the root component of a small in-memory router that also knows the
 * shell's destinations (`/chats`, `/settings`, `/login`), so `Link` and `useNavigate`
 * have a real router to work against without loading the whole generated route tree.
 */
export async function renderWithRouter(ui: ReactNode, initialPath = '/chats') {
  const rootRoute = createRootRoute({ component: () => <>{ui}</> });
  const destinations = ['/chats', '/settings', '/login'].map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren(destinations),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  await router.load();
  return { router, ...render(<RouterProvider router={router} />) };
}
