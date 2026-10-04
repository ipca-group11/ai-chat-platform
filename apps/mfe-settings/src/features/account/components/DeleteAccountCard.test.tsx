import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, renderWithClient } from "@platform/test-utils";
import { delay, http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { expectNoA11yViolations } from "../../../shared/test/a11y";
import { DeleteAccountCard } from "./DeleteAccountCard";

const useCurrentUserIdMock = vi.fn();

vi.mock("../../api-keys", () => ({
  useCurrentUserId: () => useCurrentUserIdMock(),
}));

const failWith = (status: number, code?: string) =>
  server.use(
    http.delete("*/auth/me", () =>
      HttpResponse.json(code ? { error: { code, message: "Failed" } } : {}, { status }),
    ),
  );

async function openDialog() {
  await userEvent.click(screen.getByRole("button", { name: "Delete account" }));
  return screen.findByRole("dialog", { name: "Delete your account?" });
}

async function confirmWith(password: string) {
  const dialog = await openDialog();
  if (password) await userEvent.type(within(dialog).getByLabelText("Password"), password);
  await userEvent.click(within(dialog).getByRole("button", { name: "Delete account" }));
  return dialog;
}

describe("DeleteAccountCard", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    useCurrentUserIdMock.mockReturnValue({ userId: "user-1", isLoading: false, isError: false });
  });

  it("renders nothing until the signed-in user is known", () => {
    useCurrentUserIdMock.mockReturnValue({ userId: undefined, isLoading: true, isError: false });

    const { container } = renderWithClient(<DeleteAccountCard onDeleted={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("offers to delete the account and asks for the password in a dialog", async () => {
    renderWithClient(<DeleteAccountCard onDeleted={vi.fn()} />);

    expect(screen.getByRole("region", { name: "Delete account" })).toHaveTextContent(/cannot be undone/i);
    const dialog = await openDialog();

    expect(within(dialog).getByLabelText("Password")).toHaveAttribute("type", "password");
    expect(within(dialog).getByLabelText("Password")).toHaveAttribute("autocomplete", "current-password");
  });

  it("sends DELETE /auth/me with the password, then forgets the keys and cached data and signs out", async () => {
    window.localStorage.setItem("llm-api-key:user-1:openai", JSON.stringify({ provider: "openai", last4: "1234", createdAt: new Date().toISOString() }));
    window.sessionStorage.setItem("llm-api-key-session:user-1:openai", "sk-1234");
    window.localStorage.setItem("llm-api-key:user-2:openai", JSON.stringify({ provider: "openai", last4: "5678", createdAt: new Date().toISOString() }));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["settings", "auth", "me"], { id: "user-1", email: "a@b.com" });
    const onDeleted = vi.fn();
    const requests = recordRequests();
    renderWithClient(<DeleteAccountCard onDeleted={onDeleted} />, { queryClient });

    await confirmWith("Secret-123");

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual(["DELETE /auth/me"]);
    expect(await requests[0]!.json()).toEqual({ password: "Secret-123" });
    expect(window.localStorage.getItem("llm-api-key:user-1:openai")).toBeNull();
    expect(window.sessionStorage.getItem("llm-api-key-session:user-1:openai")).toBeNull();
    expect(window.localStorage.getItem("llm-api-key:user-2:openai")).not.toBeNull();
    expect(queryClient.getQueryData(["settings", "auth", "me"])).toBeUndefined();
  });

  it("asks for the password before sending anything", async () => {
    const requests = recordRequests();
    renderWithClient(<DeleteAccountCard onDeleted={vi.fn()} />);

    const dialog = await confirmWith("");

    expect(within(dialog).getByRole("alert")).toHaveTextContent("Enter your password.");
    expect(within(dialog).getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
    expect(requests).toEqual([]);
  });

  it.each([
    [401, "INVALID_CREDENTIALS", "That password is not correct."],
    [401, "UNAUTHENTICATED", "Your session has ended. Sign in again to delete your account."],
    [429, "RATE_LIMITED", "Too many attempts. Please wait a while and try again."],
    [502, "ACCOUNT_DELETION_FAILED", "Your account could not be deleted. Please try again."],
    [503, undefined, "Your account could not be deleted. Please try again."],
  ])("a %i %s answer shows an error in the dialog and keeps the user signed in", async (status, code, message) => {
    failWith(status, code);
    const onDeleted = vi.fn();
    renderWithClient(<DeleteAccountCard onDeleted={onDeleted} />);

    const dialog = await confirmWith("Secret-123");

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(message);
    expect(within(dialog).getByLabelText("Password")).toHaveAccessibleDescription(message);
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("shows the generic error when the server cannot be reached", async () => {
    server.use(http.delete("*/auth/me", () => HttpResponse.error()));
    renderWithClient(<DeleteAccountCard onDeleted={vi.fn()} />);

    const dialog = await confirmWith("Secret-123");

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Your account could not be deleted. Please try again.");
  });

  it("keeps the dialog open and its buttons busy while the deletion runs", async () => {
    server.use(
      http.delete("*/auth/me", async () => {
        await delay("infinite");
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderWithClient(<DeleteAccountCard onDeleted={vi.fn()} />);

    const dialog = await confirmWith("Secret-123");

    expect(await within(dialog).findByRole("button", { name: "Delete account", busy: true })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog", { name: "Delete your account?" })).toBeInTheDocument();
  });

  it("Cancel closes the dialog, and it opens again empty and without the last error", async () => {
    failWith(401, "INVALID_CREDENTIALS");
    renderWithClient(<DeleteAccountCard onDeleted={vi.fn()} />);
    const dialog = await confirmWith("wrong");
    await within(dialog).findByRole("alert");

    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const reopened = await openDialog();
    expect(within(reopened).getByLabelText("Password")).toHaveValue("");
    expect(within(reopened).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("goes to /login by default once the account is deleted", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    try {
      renderWithClient(<DeleteAccountCard />);

      await confirmWith("Secret-123");

      await waitFor(() => expect(assign).toHaveBeenCalledWith("/login"));
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("has no accessibility violations, closed and with the dialog open", async () => {
    const { container } = renderWithClient(<DeleteAccountCard onDeleted={vi.fn()} />);
    await expectNoA11yViolations(container);

    await openDialog();
    await expectNoA11yViolations(document.body);
  });
});
