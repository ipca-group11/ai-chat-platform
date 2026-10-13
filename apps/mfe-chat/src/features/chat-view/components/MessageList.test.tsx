import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Message } from "../../../shared/types";
import { MessageList } from "./MessageList";

function makeMessage(overrides: Partial<Message>): Message {
  return {
    id: "msg-1",
    chatId: "chat-1",
    role: "assistant",
    content: "Hello",
    attachments: [],
    status: "sent",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("MessageList (AC-52, AC-53, AC-54, AC-57)", () => {
  it("AICHAT-175: the log is aria-busy while a reply streams, so a screen reader announces the reply once, at the end", () => {
    const { rerender } = render(
      <MessageList messages={[makeMessage({ status: "streaming", content: "Hel" })]} onStop={vi.fn()} onRetry={vi.fn()} />
    );
    const log = screen.getByRole("log", { name: "Messages" });
    expect(log).toHaveAttribute("aria-live", "polite");
    expect(log).toHaveAttribute("aria-busy", "true");

    rerender(<MessageList messages={[makeMessage({ status: "sent", content: "Hello" })]} onStop={vi.fn()} onRetry={vi.fn()} />);
    expect(log).toHaveAttribute("aria-busy", "false");
  });

  it("AC-53: renders the chat's full history", () => {
    const messages = [
      makeMessage({ id: "1", role: "user", content: "Hi" }),
      makeMessage({ id: "2", role: "assistant", content: "Hello there" }),
    ];
    render(<MessageList messages={messages} onStop={vi.fn()} onRetry={vi.fn()} />);

    expect(screen.getByText("Hi")).toBeInTheDocument();
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  it("AC-57: excludes queued messages from the history view (they belong to the queue feature)", () => {
    const messages = [makeMessage({ id: "1", status: "queued", content: "Waiting" })];
    render(<MessageList messages={messages} onStop={vi.fn()} onRetry={vi.fn()} />);

    expect(screen.queryByText("Waiting")).not.toBeInTheDocument();
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });

  it("AC-52: shows an in-progress streaming message with its incremental content", () => {
    const messages = [makeMessage({ id: "1", status: "streaming", content: "Partial resp" })];
    render(<MessageList messages={messages} onStop={vi.fn()} onRetry={vi.fn()} />);

    expect(screen.getByTestId("assistant-message")).toHaveAttribute("data-status", "streaming");
    expect(screen.getByText("Partial resp")).toBeInTheDocument();
  });

  it("AC-54: lets the user stop a message that is currently streaming", async () => {
    const onStop = vi.fn();
    const messages = [makeMessage({ id: "1", status: "streaming", content: "Partial" })];
    render(<MessageList messages={messages} onStop={onStop} onRetry={vi.fn()} />);

    await userEvent.click(screen.getByText("Stop"));

    expect(onStop).toHaveBeenCalledWith("1");
  });

  it("labels user messages from other members of a shared chat with their email", () => {
    const messages = [
      makeMessage({ id: "1", role: "user", content: "Mine", authorId: "me", authorEmail: "me@example.com" }),
      makeMessage({ id: "2", role: "user", content: "Theirs", authorId: "guest", authorEmail: "guest@example.com" }),
    ];
    render(<MessageList messages={messages} currentUserId="me" onStop={vi.fn()} onRetry={vi.fn()} />);

    expect(screen.getByText("guest@example.com")).toBeInTheDocument();
    expect(screen.queryByText("me@example.com")).not.toBeInTheDocument();
  });

  describe("reasoning", () => {
    it("shows a collapsed Thinking section on a finished reply and expands it on click", async () => {
      render(<MessageList messages={[makeMessage({ reasoning: "Step one" })]} onStop={vi.fn()} onRetry={vi.fn()} />);

      const toggle = screen.getByRole("button", { name: "Thinking" });
      expect(toggle).toHaveAttribute("aria-expanded", "false");
      expect(screen.queryByText("Step one")).not.toBeInTheDocument();

      await userEvent.click(toggle);
      expect(screen.getByRole("region", { name: "Model reasoning" })).toHaveTextContent("Step one");
    });

    it("is expanded while the model is still thinking", () => {
      render(
        <MessageList
          messages={[makeMessage({ content: "", status: "streaming", reasoning: "Working it out" })]}
          onStop={vi.fn()}
          onRetry={vi.fn()}
        />
      );

      expect(screen.getByRole("button", { name: "Thinking…" })).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByText("Working it out")).toBeInTheDocument();
    });

    it("hides reasoning entirely when showReasoning is off", () => {
      render(
        <MessageList messages={[makeMessage({ reasoning: "Step one" })]} onStop={vi.fn()} onRetry={vi.fn()} showReasoning={false} />
      );

      expect(screen.queryByRole("button", { name: "Thinking" })).not.toBeInTheDocument();
      expect(screen.getByText("Hello")).toBeInTheDocument();
    });
  });

  describe("web fetches", () => {
    it("lists fetched pages as links, in-flight fetches and failures", () => {
      render(
        <MessageList
          messages={[
            makeMessage({
              content: "",
              status: "streaming",
              webFetches: [
                { id: "f1", url: "https://www.example.com/a", status: "done", title: "Example page" },
                { id: "f2", url: "https://slow.test/b", status: "fetching" },
                { id: "f3", url: "https://down.test/c", status: "error", errorCode: "url_not_accessible" },
              ],
            }),
          ]}
          onStop={vi.fn()}
          onRetry={vi.fn()}
        />
      );

      const list = screen.getByRole("list", { name: "Pages fetched" });
      expect(within(list).getByRole("link", { name: "Example page" })).toHaveAttribute("href", "https://www.example.com/a");
      expect(list).toHaveTextContent("example.com");
      expect(list).toHaveTextContent("Fetching slow.test…");
      expect(list).toHaveTextContent("Couldn’t fetch down.test: the page couldn't be loaded");
    });

    it("never turns a non-web URL into a link", () => {
      render(
        <MessageList
          messages={[makeMessage({ webFetches: [{ id: "f1", url: "javascript:alert(1)", status: "done", title: "Bad" }] })]}
          onStop={vi.fn()}
          onRetry={vi.fn()}
        />
      );
      expect(screen.queryByRole("link", { name: "Bad" })).not.toBeInTheDocument();
    });
  });
});
