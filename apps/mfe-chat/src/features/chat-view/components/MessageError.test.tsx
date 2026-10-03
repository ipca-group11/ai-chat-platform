import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Message } from "../../../shared/types";
import { MessageError } from "./MessageError";

const failedMessage: Message = {
  id: "msg-1",
  chatId: "chat-1",
  role: "assistant",
  content: "",
  attachments: [],
  status: "failed",
  error: "Rate limit exceeded, try again shortly.",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("MessageError (AC-72, AC-73)", () => {
  it("AC-72: renders nothing for a message that has not failed", () => {
    const { container } = render(
      <MessageError message={{ ...failedMessage, status: "sent", error: null }} onRetry={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("AC-72: surfaces the provider error message without crashing", () => {
    render(<MessageError message={failedMessage} onRetry={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Rate limit exceeded, try again shortly.");
  });

  it("AC-73: lets the user retry the failed message", async () => {
    const onRetry = vi.fn();
    render(<MessageError message={failedMessage} onRetry={onRetry} />);

    await userEvent.click(screen.getByText("Retry"));

    expect(onRetry).toHaveBeenCalledWith("msg-1");
  });
});
