import { describe, expect, it } from "vitest";
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate as useRouterNavigate,
} from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useNavigate } from "./navigation";

function GoToLogin() {
  const navigate = useNavigate();
  return <button onClick={() => void navigate({ to: "/login" })}>go</button>;
}

describe("navigation", () => {
  it("re-exports the router's useNavigate, so the shell's shared router is the one used", () => {
    expect(useNavigate).toBe(useRouterNavigate);
  });

  it("navigates the router that is in scope", async () => {
    const root = createRootRoute();
    const home = createRoute({ getParentRoute: () => root, path: "/", component: GoToLogin });
    const login = createRoute({ getParentRoute: () => root, path: "/login", component: () => <p>login page</p> });
    const router = createRouter({
      routeTree: root.addChildren([home, login]),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    const user = userEvent.setup();
    render(<RouterProvider router={router} />);

    await user.click(await screen.findByRole("button", { name: "go" }));

    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
  });
});
