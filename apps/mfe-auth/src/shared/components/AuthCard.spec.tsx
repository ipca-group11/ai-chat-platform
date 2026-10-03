import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthCard } from "./AuthCard";

const navigateMock = vi.fn();

vi.mock("../navigation", () => ({
  useNavigate: () => navigateMock,
}));

function renderCard(switchTo: "/login" | "/register" = "/register") {
  return render(
    <AuthCard
      title="Sign in"
      description="Welcome back"
      switchPrompt="Don't have an account?"
      switchLabel="Create one"
      switchTo={switchTo}
    >
      <p>form goes here</p>
    </AuthCard>,
  );
}

describe("AuthCard", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it("renders the title, description, its children and the switch prompt", () => {
    renderCard();

    expect(screen.getByText("Sign in")).toBeInTheDocument();
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByText("form goes here")).toBeInTheDocument();
    expect(screen.getByText(/Don't have an account\?/)).toBeInTheDocument();
  });

  it("links to the sibling screen with a real href, so it also works when opened in a new tab", () => {
    renderCard("/register");

    expect(screen.getByRole("link", { name: "Create one" })).toHaveAttribute("href", "/register");
  });

  it("navigates client-side to the sibling screen instead of reloading the page", async () => {
    const user = userEvent.setup();
    renderCard("/login");

    await user.click(screen.getByRole("link", { name: "Create one" }));

    expect(navigateMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith({ to: "/login" });
  });
});
