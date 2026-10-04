import { createContext, useContext, useState, type ReactNode } from "react";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import userEvent from "@testing-library/user-event";
import { LogoutButton } from "./LogoutButton";

// What the stubbed `fetch` answers for `POST /auth/logout`: a response, or a request that
// never settles so the pending ("Signing out…") state stays on screen.
type AuthApiMock = { status: number } | "pending";

// The story is rendered by the root route itself, so the button gets a real router context
// for the `/login` redirect without the story owning any of the app's routes.
const StorySlot = createContext<ReactNode>(null);

function StoryOutlet() {
  return useContext(StorySlot);
}

function StoryProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { mutations: { retry: false } } }),
  );
  const [router] = useState(() => {
    const rootRoute = createRootRoute({ component: StoryOutlet });
    const routes = ["/chats", "/login"].map((path) =>
      createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
    );
    return createRouter({
      routeTree: rootRoute.addChildren(routes),
      history: createMemoryHistory({ initialEntries: ["/chats"] }),
    });
  });

  return (
    <QueryClientProvider client={queryClient}>
      <StorySlot.Provider value={children}>
        <RouterProvider router={router} />
      </StorySlot.Provider>
    </QueryClientProvider>
  );
}

const withProviders: Decorator = (Story) => (
  <StoryProviders>
    <Story />
  </StoryProviders>
);

const meta = {
  title: "App/Auth/LogoutButton",
  component: LogoutButton,
  tags: ["autodocs"],
  decorators: [withProviders],
  // No network: the logout request is answered from `parameters.authApi`.
  beforeEach: ({ parameters }) => {
    const mock = (parameters.authApi as AuthApiMock | undefined) ?? { status: 204 };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      mock === "pending"
        ? new Promise<Response>(() => {})
        : Promise.resolve(new Response(null, { status: mock.status }));
    return () => {
      globalThis.fetch = originalFetch;
    };
  },
} satisfies Meta<typeof LogoutButton>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The logout request is in flight: the button shows its loading state. */
export const SigningOut: Story = {
  parameters: { authApi: "pending" satisfies AuthApiMock },
  play: async ({ canvasElement }) => {
    const button = canvasElement.querySelector<HTMLButtonElement>("button");
    if (!button) throw new Error("Logout button did not render");
    await userEvent.setup().click(button);
  },
};
