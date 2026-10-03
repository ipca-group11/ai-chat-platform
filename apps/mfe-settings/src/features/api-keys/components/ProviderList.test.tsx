import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithQueryClient } from "../../../shared/test/render";
import { ProviderList } from "./ProviderList";

const useCurrentUserIdMock = vi.fn();

vi.mock("../hooks/useCurrentUserId", () => ({
  useCurrentUserId: () => useCurrentUserIdMock(),
}));

describe("ProviderList", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    useCurrentUserIdMock.mockReturnValue({ userId: "user-1", isLoading: false, isError: false });
  });

  it("AC-76: renders an editable key field + Save for OpenAI and Anthropic", () => {
    renderWithQueryClient(<ProviderList />);

    expect(screen.getByLabelText("OpenAI API key")).toBeInTheDocument();
    expect(screen.getByLabelText("Anthropic API key")).toBeInTheDocument();
  });

  it("AC-77: renders Ollama as a static 'no API key required' state with no input", () => {
    renderWithQueryClient(<ProviderList />);

    expect(screen.getByText(/no api key is required/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Ollama API key")).not.toBeInTheDocument();
  });

  it("AC-76: saving a key for a provider updates its masked display", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<ProviderList />);

    const openaiForm = screen.getByRole("form", { name: "OpenAI API key form" });
    await user.type(screen.getByLabelText("OpenAI API key"), "sk-abcd1234");
    await user.click(within(openaiForm).getByRole("button", { name: "Save key" }));

    expect(screen.getByTestId("masked-key")).toHaveTextContent("1234");
  });

  it("shows a loading message while the current user is being resolved", () => {
    useCurrentUserIdMock.mockReturnValue({ userId: undefined, isLoading: true, isError: false });
    renderWithQueryClient(<ProviderList />);

    expect(screen.getByText(/loading your account/i)).toBeInTheDocument();
  });

  it("AC-87: removing a saved key clears its masked display", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<ProviderList />);

    const openaiForm = screen.getByRole("form", { name: "OpenAI API key form" });
    await user.type(screen.getByLabelText("OpenAI API key"), "sk-abcd1234");
    await user.click(within(openaiForm).getByRole("button", { name: "Save key" }));
    expect(screen.getByTestId("masked-key")).toBeInTheDocument();

    await user.click(within(openaiForm).getByRole("button", { name: "Remove key" }));

    expect(screen.queryByTestId("masked-key")).not.toBeInTheDocument();
  });

  it("shows a sign-in message and no provider forms when there is no current user", () => {
    useCurrentUserIdMock.mockReturnValue({ userId: undefined, isLoading: false, isError: true });
    renderWithQueryClient(<ProviderList />);

    expect(screen.getByRole("alert")).toHaveTextContent(/sign in/i);
    expect(screen.queryByLabelText("OpenAI API key")).not.toBeInTheDocument();
  });

  it("AC-80: a different user id never shows the first user's saved key", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithQueryClient(<ProviderList />);

    const openaiForm = screen.getByRole("form", { name: "OpenAI API key form" });
    await user.type(screen.getByLabelText("OpenAI API key"), "sk-user-one-1111");
    await user.click(within(openaiForm).getByRole("button", { name: "Save key" }));
    expect(screen.getByTestId("masked-key")).toBeInTheDocument();

    useCurrentUserIdMock.mockReturnValue({ userId: "user-2", isLoading: false, isError: false });
    rerender(<ProviderList />);

    expect(screen.queryByTestId("masked-key")).not.toBeInTheDocument();
  });

  it("asks to re-enter a key saved in an earlier session", () => {
    window.localStorage.setItem(
      "llm-api-key:user-1:anthropic",
      JSON.stringify({ provider: "anthropic", last4: "abcd", createdAt: new Date().toISOString() })
    );
    renderWithQueryClient(<ProviderList />);

    expect(screen.getByText("Re-enter key")).toBeInTheDocument();
    expect(screen.getByText(/only kept for this browser tab session/i)).toBeInTheDocument();
  });
});
