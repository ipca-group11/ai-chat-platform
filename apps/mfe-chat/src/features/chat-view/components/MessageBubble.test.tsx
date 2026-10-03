import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Message } from "../../../shared/types";
import { MessageBubble, type MessageBubbleProps } from "./MessageBubble";

const base: Message = {
  id: "m1",
  chatId: "chat-1",
  role: "assistant",
  content: "Hello there",
  attachments: [],
  status: "sent",
  createdAt: "2026-01-01T00:00:00.000Z",
};

function bubble(message: Partial<Message>, props: Partial<MessageBubbleProps> = {}) {
  return render(
    <ul>
      <MessageBubble message={{ ...base, ...message }} {...props} />
    </ul>
  );
}

describe("MessageBubble", () => {
  it("renders the assistant's reply as markdown", () => {
    bubble({ content: "**Bold** and a list:\n\n- one\n- two" });

    expect(screen.getByText("Bold").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(expect.arrayContaining(["one", "two"]));
  });

  it("does not turn markdown in the user's own message into markup", () => {
    bubble({ role: "user", content: "**not bold**" });

    expect(screen.getByText("**not bold**")).toBeInTheDocument();
    expect(screen.queryByText("not bold")).not.toBeInTheDocument();
  });

  it("marks the row with its role, id and status", () => {
    bubble({ role: "user", status: "queued", id: "m9" });

    const row = screen.getByTestId("user-message");
    expect(row).toHaveAttribute("data-message-id", "m9");
    expect(row).toHaveAttribute("data-status", "queued");
  });

  describe("messages from another member", () => {
    it("labels them with the author's email", () => {
      bubble({ role: "user", authorId: "u2", authorEmail: "guest@example.test" }, { currentUserId: "u1" });

      expect(screen.getByText("guest@example.test")).toBeInTheDocument();
      expect(screen.getByText("Hello there")).toBeInTheDocument();
    });

    it("falls back to a generic label when the email is unknown", () => {
      bubble({ role: "user", authorId: "u2", authorEmail: null }, { currentUserId: "u1" });

      expect(screen.getByText("Another member")).toBeInTheDocument();
    });

    it("does not label the current user's own messages", () => {
      bubble({ role: "user", authorId: "u1", authorEmail: "me@example.test" }, { currentUserId: "u1" });

      expect(screen.queryByText("me@example.test")).not.toBeInTheDocument();
    });

    it("does not label anyone when the viewer is not known", () => {
      bubble({ role: "user", authorId: "u2", authorEmail: "guest@example.test" });

      expect(screen.queryByText("guest@example.test")).not.toBeInTheDocument();
    });
  });

  describe("reasoning", () => {
    it("shows the reasoning section above an assistant reply that has some", () => {
      bubble({ reasoning: "Because." });

      expect(screen.getByRole("button", { name: "Thinking" })).toBeInTheDocument();
    });

    it("is open and pulsing while the model thinks before any answer", () => {
      bubble({ reasoning: "Because.", content: "", status: "streaming" });

      expect(screen.getByRole("button", { name: "Thinking…" })).toHaveAttribute("aria-expanded", "true");
      expect(screen.getByRole("region", { name: "Model reasoning" })).toHaveTextContent("Because.");
    });

    it("is collapsed once the answer streams in", () => {
      bubble({ reasoning: "Because.", content: "Answer", status: "streaming" });

      expect(screen.getByRole("button", { name: "Thinking" })).toHaveAttribute("aria-expanded", "false");
    });

    it("is hidden when the user turned reasoning off", () => {
      bubble({ reasoning: "Because." }, { showReasoning: false });

      expect(screen.queryByRole("button", { name: /Thinking/ })).not.toBeInTheDocument();
    });

    it("is never shown on a user message", () => {
      bubble({ role: "user", reasoning: "Because." });

      expect(screen.queryByRole("button", { name: /Thinking/ })).not.toBeInTheDocument();
    });
  });

  describe("web fetches", () => {
    const fetches = [{ id: "f1", url: "https://example.test/a", status: "done" as const, title: "A page" }];

    it("lists the pages the model read for an assistant reply", () => {
      bubble({ webFetches: fetches });

      expect(within(screen.getByRole("list", { name: "Pages fetched" })).getByRole("link", { name: "A page" })).toBeInTheDocument();
    });

    it("shows no list when there are none, or on a user message", () => {
      bubble({ webFetches: [] });
      bubble({ role: "user", webFetches: fetches });

      expect(screen.queryByRole("list", { name: "Pages fetched" })).not.toBeInTheDocument();
    });
  });

  it("lists attachments by file name", () => {
    bubble({
      role: "user",
      attachments: [
        { id: "a1", messageId: "m1", filename: "notes.txt", mimeType: "text/plain", size: 5, kind: "text" },
        { id: "a2", messageId: "m1", filename: "scan.pdf", mimeType: "application/pdf", size: 9, kind: "pdf" },
      ],
    });

    const list = screen.getByRole("list", { name: "Message attachments" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["notes.txt", "scan.pdf"]);
  });

  describe("streaming", () => {
    it("announces progress and stops the reply by message id", async () => {
      const onStop = vi.fn();
      bubble({ status: "streaming", content: "Partial" }, { onStop });

      expect(screen.getByRole("status", { name: "Generating response" })).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Stop" }));

      expect(onStop).toHaveBeenCalledWith("m1");
    });

    it("offers no stop button without a handler", () => {
      bubble({ status: "streaming", content: "Partial" });

      expect(screen.getByRole("status", { name: "Generating response" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Stop" })).not.toBeInTheDocument();
    });

    it("shows hidden typing dots before the first token", () => {
      const { container } = bubble({ status: "streaming", content: "" });

      expect(container.querySelectorAll("[aria-hidden='true'] .animate-pulse")).toHaveLength(3);
    });

    it("shows no typing dots when fetch activity is already visible", () => {
      const { container } = bubble({
        status: "streaming",
        content: "",
        webFetches: [{ id: "f1", url: "https://example.test", status: "fetching" }],
      });

      expect(container.querySelectorAll("[aria-hidden='true'] .animate-pulse")).toHaveLength(0);
    });

    it("shows no progress once the reply is complete", () => {
      bubble({ status: "sent" });

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  describe("failed replies", () => {
    it("shows the provider error and retries by message id", async () => {
      const onRetry = vi.fn();
      bubble({ status: "failed", content: "", error: "Rate limited" }, { onRetry });

      expect(screen.getByText("Response failed")).toBeInTheDocument();
      expect(screen.getByText("Rate limited")).toBeInTheDocument();
      await userEvent.click(screen.getByRole("button", { name: "Retry" }));

      expect(onRetry).toHaveBeenCalledWith("m1");
    });

    it("shows no error block without a retry handler", () => {
      bubble({ status: "failed", content: "", error: "Rate limited" });

      expect(screen.queryByText("Response failed")).not.toBeInTheDocument();
    });
  });
});
