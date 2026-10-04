import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@platform/test-utils";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { RegisterForm } from "./RegisterForm";

const navigateMock = vi.fn();

vi.mock("../../../shared/navigation", () => ({
  useNavigate: () => navigateMock,
}));

describe("RegisterForm", () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it("AC-30: renders the registration form's email and password fields", () => {
    renderWithClient(<RegisterForm />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create account/i })).toBeInTheDocument();
  });

  it("AC-30: client validation blocks submit on an invalid email, without calling the API", async () => {
    const requests = recordRequests();
    const user = userEvent.setup();
    renderWithClient(<RegisterForm />);

    await user.type(screen.getByLabelText("Email"), "not-an-email");
    await user.type(screen.getByLabelText("Password"), "goodpass1");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/valid email/i)).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it("AC-32: client validation blocks submit on a password that fails the policy, without calling the API", async () => {
    const requests = recordRequests();
    const user = userEvent.setup();
    renderWithClient(<RegisterForm />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "short1");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/at least 8 characters/i)).toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it("AC-31: displays the server's duplicate-email error and does not navigate away", async () => {
    server.use(
      http.post("*/auth/register", () =>
        HttpResponse.json({ error: "Email already registered" }, { status: 409 }),
      ),
    );
    const user = userEvent.setup();
    renderWithClient(<RegisterForm />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "goodpass1");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("Email already registered")).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("AC-34: redirects to /login after a successful registration", async () => {
    const requests = recordRequests();
    const user = userEvent.setup();
    renderWithClient(<RegisterForm />);

    await user.type(screen.getByLabelText("Email"), "user@example.com");
    await user.type(screen.getByLabelText("Password"), "goodpass1");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith({ to: "/login" }));
    expect(requests.map((r) => new URL(r.url).pathname)).toEqual(["/auth/register"]);
  });
});
