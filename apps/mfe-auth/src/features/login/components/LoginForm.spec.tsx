import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQueryClient } from "../../../shared/test/render";
import { LoginForm } from "./LoginForm";

const navigateMock = vi.fn();

vi.mock("../../../shared/navigation", () => ({
  useNavigate: () => navigateMock,
}));

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("LoginForm", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-35: renders the login form's email and password fields", () => {
    renderWithQueryClient(<LoginForm />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("AC-35: a valid login navigates to the chat list route", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ id: "1", email: "user@example.com" }, 200),
    );
    const user = userEvent.setup();
    renderWithQueryClient(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/chats" }));
  });

  it("AC-36: invalid credentials show the single generic error message as-is, without navigating", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: "Invalid email or password" }, 401),
    );
    const user = userEvent.setup();
    renderWithQueryClient(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("AC-36: the same generic message is shown regardless of an unknown email vs a wrong password", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ error: "Invalid email or password" }, 401),
    );
    const user = userEvent.setup();
    renderWithQueryClient(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "unknown@example.com");
    await user.type(screen.getByLabelText("Password"), "whatever1");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  });

  it("blocks submit client-side when a field is empty, without calling the API", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<LoginForm />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/required/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });
});
