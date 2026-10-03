import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQueryClient } from "../../../shared/test/render";
import { RegisterForm } from "./RegisterForm";

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

describe("RegisterForm", () => {
  beforeEach(() => {
    navigateMock.mockReset();
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-30: renders the registration form's email and password fields", () => {
    renderWithQueryClient(<RegisterForm />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("AC-30: client validation blocks submit on an invalid email, without calling the API", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<RegisterForm />);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "goodpass1");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("AC-32: client validation blocks submit on a password that fails the policy, without calling the API", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<RegisterForm />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "short1");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("AC-31: displays the server's duplicate-email error and does not navigate away", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "Email already registered" }, 409));
    const user = userEvent.setup();
    renderWithQueryClient(<RegisterForm />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "goodpass1");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Email already registered")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("AC-34: redirects to /login after a successful registration", async () => {
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ id: "1", email: "user@example.com" }, 201),
    );
    const user = userEvent.setup();
    renderWithQueryClient(<RegisterForm />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "goodpass1");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/login" }));
  });
});
