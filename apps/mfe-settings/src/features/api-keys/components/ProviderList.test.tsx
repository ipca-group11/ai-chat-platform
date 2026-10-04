import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@platform/test-utils";
import { expectNoA11yViolations } from "../../../shared/test/a11y";
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
    renderWithClient(<ProviderList />);

    expect(screen.getByLabelText("OpenAI API key")).toBeInTheDocument();
    expect(screen.getByLabelText("Anthropic API key")).toBeInTheDocument();
  });

  it("AC-77: renders Ollama as a static 'no API key required' state with no input", () => {
    renderWithClient(<ProviderList />);

    expect(screen.getByText(/no api key is required/i)).toBeInTheDocument();
    expect(screen.queryByLabelText("Ollama API key")).not.toBeInTheDocument();
  });

  it("AC-77: marks Ollama, the keyless provider, as Local with no key status, form or test button", () => {
    renderWithClient(<ProviderList />);

    const ollamaCard = screen.getByRole("heading", { level: 2, name: "Ollama" }).closest("div[class*='rounded']") as HTMLElement;
    expect(within(ollamaCard).getByText("Local")).toBeInTheDocument();
    expect(within(ollamaCard).getByText("Ollama runs locally — no API key is required to use it.")).toBeInTheDocument();
    expect(within(ollamaCard).queryByText(/configured|re-enter key/i)).not.toBeInTheDocument();
    expect(within(ollamaCard).queryByRole("form")).not.toBeInTheDocument();
    expect(within(ollamaCard).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getAllByText("Local")).toHaveLength(1);
  });

  it("AC-76: saving a key for a provider updates its masked display", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProviderList />);

    const openaiForm = screen.getByRole("form", { name: "OpenAI API key form" });
    await user.type(screen.getByLabelText("OpenAI API key"), "sk-abcd1234");
    await user.click(within(openaiForm).getByRole("button", { name: "Save key" }));

    expect(screen.getByTestId("masked-key")).toHaveTextContent("1234");
  });

  it("shows a loading message while the current user is being resolved", () => {
    useCurrentUserIdMock.mockReturnValue({ userId: undefined, isLoading: true, isError: false });
    renderWithClient(<ProviderList />);

    expect(screen.getByText(/loading your account/i)).toBeInTheDocument();
  });

  it("AC-87: removing a saved key clears its masked display", async () => {
    const user = userEvent.setup();
    renderWithClient(<ProviderList />);

    const openaiForm = screen.getByRole("form", { name: "OpenAI API key form" });
    await user.type(screen.getByLabelText("OpenAI API key"), "sk-abcd1234");
    await user.click(within(openaiForm).getByRole("button", { name: "Save key" }));
    expect(screen.getByTestId("masked-key")).toBeInTheDocument();

    await user.click(within(openaiForm).getByRole("button", { name: "Remove key" }));

    expect(screen.queryByTestId("masked-key")).not.toBeInTheDocument();
  });

  it("shows a sign-in message and no provider forms when there is no current user", () => {
    useCurrentUserIdMock.mockReturnValue({ userId: undefined, isLoading: false, isError: true });
    renderWithClient(<ProviderList />);

    expect(screen.getByRole("alert")).toHaveTextContent(/sign in/i);
    expect(screen.queryByLabelText("OpenAI API key")).not.toBeInTheDocument();
  });

  it("AC-80: a different user id never shows the first user's saved key", async () => {
    const user = userEvent.setup();
    const { rerender } = renderWithClient(<ProviderList />);

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
    renderWithClient(<ProviderList />);

    expect(screen.getByText("Re-enter key")).toBeInTheDocument();
    expect(screen.getByText(/only kept for this browser tab session/i)).toBeInTheDocument();
  });

  describe("status badges", () => {
    const badgeOf = (providerName: string) => {
      const card = screen.getByText(providerName, { selector: "h3, [class*='text-lg']" }).closest("div[class*='rounded']");
      return card as HTMLElement;
    };

    it("has no accessibility violations in its main state", async () => {
      const { container } = renderWithClient(<ProviderList />);

      await expectNoA11yViolations(container);
    });

    it("has no accessibility violations once a key is saved", async () => {
      const user = userEvent.setup();
      const { container } = renderWithClient(<ProviderList />);
      await user.type(screen.getByLabelText("OpenAI API key"), "sk-abcd1234");
      await user.click(within(screen.getByRole("form", { name: "OpenAI API key form" })).getByRole("button", { name: "Save key" }));

      await expectNoA11yViolations(container);
    });

    it("shows 'Not configured' for every provider before any key is saved", () => {
      renderWithClient(<ProviderList />);

      expect(screen.getAllByText("Not configured")).toHaveLength(2);
      expect(screen.queryByText("Configured")).not.toBeInTheDocument();
      expect(screen.queryByText("Re-enter key")).not.toBeInTheDocument();
    });

    it("shows 'Configured' only for the provider whose key was saved, and 'Not configured' again after removing it", async () => {
      const user = userEvent.setup();
      renderWithClient(<ProviderList />);
      const openaiForm = screen.getByRole("form", { name: "OpenAI API key form" });

      await user.type(screen.getByLabelText("OpenAI API key"), "sk-abcd1234");
      await user.click(within(openaiForm).getByRole("button", { name: "Save key" }));

      expect(screen.getAllByText("Configured")).toHaveLength(1);
      expect(screen.getAllByText("Not configured")).toHaveLength(1);
      expect(within(badgeOf("OpenAI")).getByText("Configured")).toBeInTheDocument();
      expect(within(badgeOf("Anthropic")).getByText("Not configured")).toBeInTheDocument();

      await user.click(within(openaiForm).getByRole("button", { name: "Remove key" }));

      expect(screen.getAllByText("Not configured")).toHaveLength(2);
      expect(screen.queryByText("Configured")).not.toBeInTheDocument();
    });

    it("shows 'Re-enter key' instead of 'Configured' for a key saved in an earlier session, until it is entered again", async () => {
      const user = userEvent.setup();
      window.localStorage.setItem(
        "llm-api-key:user-1:anthropic",
        JSON.stringify({ provider: "anthropic", last4: "abcd", createdAt: new Date().toISOString() })
      );
      renderWithClient(<ProviderList />);
      expect(within(badgeOf("Anthropic")).getByText("Re-enter key")).toBeInTheDocument();
      expect(screen.queryByText("Configured")).not.toBeInTheDocument();

      await user.type(screen.getByLabelText("Anthropic API key"), "sk-ant-abcd");
      await user.click(screen.getByRole("button", { name: "Update key" }));

      expect(within(badgeOf("Anthropic")).getByText("Configured")).toBeInTheDocument();
      expect(screen.queryByText("Re-enter key")).not.toBeInTheDocument();
    });
  });

  describe("when the browser refuses to store the key", () => {
    const refuseStorage = () =>
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("shows an error next to the form, does not mark the provider as configured and keeps the form available", async () => {
      refuseStorage();
      const user = userEvent.setup();
      renderWithClient(<ProviderList />);
      const openaiForm = screen.getByRole("form", { name: "OpenAI API key form" });

      await user.type(screen.getByLabelText("OpenAI API key"), "sk-abcd1234");
      await user.click(within(openaiForm).getByRole("button", { name: "Save key" }));

      expect(within(openaiForm).getByRole("alert")).toHaveTextContent(/could not be saved in this browser/i);
      expect(screen.getByLabelText("OpenAI API key")).toHaveAccessibleDescription(/could not be saved/i);
      expect(screen.getAllByText("Not configured")).toHaveLength(2);
      expect(screen.queryByText("Configured")).not.toBeInTheDocument();
      expect(screen.queryByTestId("masked-key")).not.toBeInTheDocument();
      expect(within(openaiForm).getByRole("button", { name: "Save key" })).toBeEnabled();
    });

    it("keeps the previous key when an update cannot be stored", async () => {
      const user = userEvent.setup();
      renderWithClient(<ProviderList />);
      const openaiForm = screen.getByRole("form", { name: "OpenAI API key form" });
      await user.type(screen.getByLabelText("OpenAI API key"), "sk-abcd1234");
      await user.click(within(openaiForm).getByRole("button", { name: "Save key" }));
      refuseStorage();

      await user.type(screen.getByLabelText("OpenAI API key"), "sk-wxyz9876");
      await user.click(within(openaiForm).getByRole("button", { name: "Update key" }));

      expect(within(openaiForm).getByRole("alert")).toHaveTextContent(/your previous key is still in use/i);
      expect(screen.getByTestId("masked-key")).toHaveTextContent("1234");
      expect(screen.getAllByText("Configured")).toHaveLength(1);
      expect(window.sessionStorage.getItem("llm-api-key-session:user-1:openai")).toBe("sk-abcd1234");
    });

    it("clears the error once the key is saved", async () => {
      const refused = refuseStorage();
      const user = userEvent.setup();
      renderWithClient(<ProviderList />);
      const openaiForm = screen.getByRole("form", { name: "OpenAI API key form" });
      await user.type(screen.getByLabelText("OpenAI API key"), "sk-abcd1234");
      await user.click(within(openaiForm).getByRole("button", { name: "Save key" }));
      expect(within(openaiForm).getByRole("alert")).toBeInTheDocument();

      refused.mockRestore();
      await user.click(within(openaiForm).getByRole("button", { name: "Save key" }));

      expect(within(openaiForm).queryByRole("alert")).not.toBeInTheDocument();
      expect(screen.getByTestId("masked-key")).toHaveTextContent("1234");
    });
  });
});
