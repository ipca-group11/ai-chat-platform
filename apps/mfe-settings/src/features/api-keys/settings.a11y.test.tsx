import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { configureAxe } from "vitest-axe";
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@app/ui";
import { renderWithClient } from "@platform/test-utils";
import App from "../../app";

const useCurrentUserIdMock = vi.fn();
const testConnectionMock = vi.fn();

vi.mock("./hooks/useCurrentUserId", () => ({
  useCurrentUserId: () => useCurrentUserIdMock(),
}));
vi.mock("./api/testConnection", () => ({
  testConnection: (...args: unknown[]) => testConnectionMock(...args),
}));

// jsdom has no layout, so colour contrast cannot be computed; it is covered by the browser checks.
const axe = configureAxe({ rules: { "color-contrast": { enabled: false } } });

/** Threshold: zero violations with impact "serious" or "critical". Fails with rule, impact and node. */
async function expectNoSeriousOrCritical(root: Element): Promise<void> {
  const results = await axe(root);
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  const report = blocking.map((v) => `${v.id} [${v.impact}] ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(report).toEqual([]);
}

describe("settings accessibility (axe)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    testConnectionMock.mockReset();
    useCurrentUserIdMock.mockReturnValue({ userId: "user-1", isLoading: false, isError: false });
  });

  it("loading state has no serious or critical violations", async () => {
    useCurrentUserIdMock.mockReturnValue({ userId: undefined, isLoading: true, isError: false });
    const { container } = renderWithClient(<App />);
    await expectNoSeriousOrCritical(container);
  });

  it("signed-out state has no serious or critical violations", async () => {
    useCurrentUserIdMock.mockReturnValue({ userId: undefined, isLoading: false, isError: true });
    const { container } = renderWithClient(<App />);
    await expectNoSeriousOrCritical(container);
  });

  it("default provider list has no serious or critical violations", async () => {
    const { container } = renderWithClient(<App />);
    await expectNoSeriousOrCritical(container);
  });

  it("validation error state has no serious or critical violations", async () => {
    const user = userEvent.setup();
    const { container } = renderWithClient(<App />);
    const form = screen.getByRole("form", { name: "OpenAI API key form" });
    await user.click(within(form).getByRole("button", { name: "Save key" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/required/i);
    await expectNoSeriousOrCritical(container);
  });

  it("saved key state has no serious or critical violations", async () => {
    const user = userEvent.setup();
    const { container } = renderWithClient(<App />);
    const form = screen.getByRole("form", { name: "OpenAI API key form" });
    await user.type(screen.getByLabelText("OpenAI API key"), "sk-abcd1234");
    await user.click(within(form).getByRole("button", { name: "Save key" }));
    expect(await screen.findByTestId("masked-key")).toBeInTheDocument();
    await expectNoSeriousOrCritical(container);
  });

  it("re-enter key state has no serious or critical violations", async () => {
    window.localStorage.setItem(
      "llm-api-key:user-1:anthropic",
      JSON.stringify({ provider: "anthropic", last4: "abcd", createdAt: new Date().toISOString() }),
    );
    const { container } = renderWithClient(<App />);
    expect(screen.getByText("Re-enter key")).toBeInTheDocument();
    await expectNoSeriousOrCritical(container);
  });

  it("test-connection failure state has no serious or critical violations", async () => {
    testConnectionMock.mockResolvedValue({ success: false, message: "Invalid key." });
    const user = userEvent.setup();
    const { container } = renderWithClient(<App />);
    await user.type(screen.getByLabelText("OpenAI API key"), "sk-abcd1234");
    await user.click(screen.getByRole("button", { name: /test openai connection/i }));
    expect(await screen.findByText("Invalid key.")).toBeInTheDocument();
    await expectNoSeriousOrCritical(container);
  });
});

function ConfirmDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button">Remove key</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove API key</DialogTitle>
          <DialogDescription>This deletes the saved key for this provider.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button type="button" variant="outline">Cancel</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

describe("settings dialog focus and accessibility", () => {
  it("open dialog has no serious or critical violations and moves focus inside", async () => {
    const user = userEvent.setup();
    renderWithClient(<ConfirmDialog />);
    await user.click(screen.getByRole("button", { name: "Remove key" }));

    const dialog = await screen.findByRole("dialog", { name: "Remove API key" });
    await waitFor(() => expect(dialog).toContainElement(document.activeElement as HTMLElement));
    await expectNoSeriousOrCritical(document.body);
  });

  it("focus returns to the trigger after Escape", async () => {
    const user = userEvent.setup();
    renderWithClient(<ConfirmDialog />);
    const trigger = screen.getByRole("button", { name: "Remove key" });
    await user.click(trigger);
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("focus returns to the trigger after the Cancel button", async () => {
    const user = userEvent.setup();
    renderWithClient(<ConfirmDialog />);
    const trigger = screen.getByRole("button", { name: "Remove key" });
    await user.click(trigger);
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
