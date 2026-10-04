import { createContext, useContext, useState, type ReactNode } from "react";
import type { Decorator, Meta, StoryObj } from "@storybook/react-vite";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { AuthCard } from "./AuthCard";

// The story is rendered by the root route itself, so the switch link gets a real router
// context for `useNavigate` without the story owning any of the app's routes.
const StorySlot = createContext<ReactNode>(null);

function StoryOutlet() {
  return useContext(StorySlot);
}

function StoryRouter({ children }: { children: ReactNode }) {
  const [router] = useState(() => {
    const rootRoute = createRootRoute({ component: StoryOutlet });
    const routes = ["/login", "/register"].map((path) =>
      createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
    );
    return createRouter({
      routeTree: rootRoute.addChildren(routes),
      history: createMemoryHistory({ initialEntries: ["/login"] }),
    });
  });

  return (
    <StorySlot.Provider value={children}>
      <RouterProvider router={router} />
    </StorySlot.Provider>
  );
}

const withRouter: Decorator = (Story) => (
  <StoryRouter>
    <Story />
  </StoryRouter>
);

const meta = {
  title: "App/Auth/AuthCard",
  component: AuthCard,
  tags: ["autodocs"],
  decorators: [withRouter],
  parameters: { layout: "fullscreen" },
  args: {
    title: "Sign in",
    description: "Enter your email and password to continue.",
    switchPrompt: "Don't have an account?",
    switchLabel: "Create one",
    switchTo: "/register",
    children: <p className="text-sm text-muted-foreground">The form for this screen renders here.</p>,
  },
} satisfies Meta<typeof AuthCard>;
export default meta;

type Story = StoryObj<typeof meta>;

/** As used by the login screen: links across to registration. */
export const SignIn: Story = {};

/** As used by the registration screen: links back to sign in. */
export const CreateAccount: Story = {
  args: {
    title: "Create an account",
    description: "Sign up with your email to start chatting.",
    switchPrompt: "Already have an account?",
    switchLabel: "Sign in",
    switchTo: "/login",
  },
};
