import { useState } from 'react';
import type { Decorator, Meta, StoryObj } from '@storybook/react-vite';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { NavBar } from './NavBar';

/**
 * `Link` needs a router. Each story gets a small in-memory one that knows the shell's
 * destinations, starting at `parameters.initialPath` so the active link can be shown.
 */
const WithRouter: Decorator = (Story, context) => {
  const initialPath = (context.parameters.initialPath as string | undefined) ?? '/chats';
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
  return <RouterProvider router={router} />;
};

const meta = {
  title: 'App/Shell/NavBar',
  component: NavBar,
  tags: ['autodocs'],
  decorators: [WithRouter],
  parameters: { layout: 'fullscreen' },
  args: {
    userEmail: 'ana@example.com',
    onLogout: () => undefined,
  },
} satisfies Meta<typeof NavBar>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Signed in, on the chats page: "Chats" is the active link. */
export const SignedIn: Story = {};

/** Signed in, on the settings page: "Settings" is the active link. */
export const SignedInOnSettings: Story = {
  parameters: { initialPath: '/settings' },
};

/** Signed out (login/register): only the brand and the theme toggle are shown. */
export const SignedOut: Story = {
  args: { userEmail: undefined },
  parameters: { initialPath: '/login' },
};
