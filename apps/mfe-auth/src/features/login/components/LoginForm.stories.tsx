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
import { LoginForm } from "./LoginForm";

// What the stubbed `fetch` answers for `POST /auth/login`: a JSON response, or a request
// that never settles so the pending ("Signing in…") state stays on screen.
type AuthApiMock = { status: number; body?: unknown } | "pending";

// The story is rendered by the root route itself, so the form gets a real router context
// for `useNavigate` without the story owning any of the app's routes.
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
    // Targets the form can navigate to; they render nothing so the form stays visible.
    const routes = ["/login", "/register", "/chats"].map((path) =>
      createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
    );
    return createRouter({
      routeTree: rootRoute.addChildren(routes),
      history: createMemoryHistory({ initialEntries: ["/login"] }),
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

async function fillAndSubmit(canvasElement: HTMLElement, email: string, password: string) {
  const user = userEvent.setup();
  const form = canvasElement.querySelector("form");
  const emailInput = canvasElement.querySelector<HTMLInputElement>('input[name="email"]');
  const passwordInput = canvasElement.querySelector<HTMLInputElement>('input[name="password"]');
  const submit = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!emailInput || !passwordInput || !submit) throw new Error("Login form did not render");

  if (email) await user.type(emailInput, email);
  if (password) await user.type(passwordInput, password);
  await user.click(submit);
}

const meta = {
  title: "App/Auth/LoginForm",
  component: LoginForm,
  tags: ["autodocs"],
  decorators: [withProviders],
  parameters: { layout: "fullscreen" },
  // No network: every story answers the login request from `parameters.authApi`.
  beforeEach: ({ parameters }) => {
    const mock = (parameters.authApi as AuthApiMock | undefined) ?? {
      status: 200,
      body: { id: "user-1", email: "user@example.com" },
    };
    const originalFetch = globalThis.fetch;
    globalThis.fetch = () =>
      mock === "pending"
        ? new Promise<Response>(() => {})
        : Promise.resolve(
            new Response(JSON.stringify(mock.body ?? {}), {
              status: mock.status,
              headers: { "Content-Type": "application/json" },
            }),
          );
    return () => {
      globalThis.fetch = originalFetch;
    };
  },
} satisfies Meta<typeof LoginForm>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

/** Submitting with empty fields is blocked client-side with one generic message. */
export const ValidationError: Story = {
  play: async ({ canvasElement }) => {
    await fillAndSubmit(canvasElement, "", "");
  },
};

/** The request is in flight: the button shows its loading state. */
export const Submitting: Story = {
  parameters: { authApi: "pending" satisfies AuthApiMock },
  play: async ({ canvasElement }) => {
    await fillAndSubmit(canvasElement, "user@example.com", "correct-password1");
  },
};

/** Wrong credentials: the server's single generic message is shown as-is (AC-36). */
export const InvalidCredentials: Story = {
  parameters: {
    authApi: { status: 401, body: { error: "Invalid email or password" } } satisfies AuthApiMock,
  },
  play: async ({ canvasElement }) => {
    await fillAndSubmit(canvasElement, "user@example.com", "wrong-password1");
  },
};
