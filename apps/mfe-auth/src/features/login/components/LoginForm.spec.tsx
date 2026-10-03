import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@platform/test-utils";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { LoginForm } from "./LoginForm";

const navigateMock = vi.fn();

vi.mock("../../../shared/navigation", () => ({
  useNavigate: () => navigateMock,
}));

describe("LoginForm", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  const rejectLogin = () =>
    server.use(
      http.post("*/auth/login", () =>
        HttpResponse.json({ error: "Invalid email or password" }, { status: 401 }),
      ),
    );

  it("AC-35: renders the login form's email and password fields", () => {
    renderWithClient(<LoginForm />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("AC-35: a valid login navigates to the chat list route", async () => {
    const requests = recordRequests();
    const user = userEvent.setup();
    renderWithClient(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/chats" }));
    expect(await requests[0]!.json()).toEqual({ email: "user@example.com", password: "correct-password" });
  });

  it("AC-36: invalid credentials show the single generic error message as-is, without navigating", async () => {
    rejectLogin();
    const user = userEvent.setup();
    renderWithClient(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("AC-36: the same generic message is shown regardless of an unknown email vs a wrong password", async () => {
    rejectLogin();
    const user = userEvent.setup();
    renderWithClient(<LoginForm />);

    await user.type(screen.getByLabelText("Email"), "unknown@example.com");
    await user.type(screen.getByLabelText("Password"), "whatever1");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  });

  it("blocks submit client-side when a field is empty, without calling the API", async () => {
    const requests = recordRequests();
    const user = userEvent.setup();
    renderWithClient(<LoginForm />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    expect(await screen.findByText(/required/i)).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });
});
