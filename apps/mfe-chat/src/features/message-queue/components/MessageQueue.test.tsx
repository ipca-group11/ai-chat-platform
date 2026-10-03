import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, withQueryClient } from "../../../test/utils";
import type { Message } from "../../../shared/types";
import { MessageQueue } from "./MessageQueue";

const queuedMessage: Message = {
  id: "msg-2",
  chatId: "chat-1",
  role: "user",
  content: "Second question",
  attachments: [],
  status: "queued",
  createdAt: "2026-01-01T00:01:00.000Z",
};

const sentMessage: Message = {
  ...queuedMessage,
  id: "msg-1",
  status: "sent",
  content: "First question",
};

describe("MessageQueue (AC-57, AC-58)", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("AC-57: shows only queued messages in a distinct queued section", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<MessageQueue chatId="chat-1" messages={[sentMessage, queuedMessage]} />, {
      wrapper: withQueryClient(),
    });

    expect(screen.getByText("Queued (1)")).toBeInTheDocument();
    expect(screen.getByText("Second question")).toBeInTheDocument();
    expect(screen.queryByText("First question")).not.toBeInTheDocument();
  });

  it("renders nothing when the queue is empty", () => {
    vi.stubGlobal("fetch", vi.fn());
    const { container } = render(<MessageQueue chatId="chat-1" messages={[sentMessage]} />, {
      wrapper: withQueryClient(),
    });

    expect(container).toBeEmptyDOMElement();
  });

  it("AC-58: cancels a queued message before it is processed", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    render(<MessageQueue chatId="chat-1" messages={[queuedMessage]} />, { wrapper: withQueryClient() });

    await userEvent.click(screen.getByLabelText("Cancel Second question"));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/chats/chat-1/messages/msg-2"),
        expect.objectContaining({ method: "DELETE" })
      )
    );
  });

  it("cancels the edit form without saving", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<MessageQueue chatId="chat-1" messages={[queuedMessage]} />, { wrapper: withQueryClient() });

    await userEvent.click(screen.getByLabelText("Edit Second question"));
    expect(screen.getByLabelText("Edit queued message")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Cancel edit"));

    expect(screen.queryByLabelText("Edit queued message")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("AC-58: edits a queued message's content before it is processed", async () => {
    const edited = { ...queuedMessage, content: "Edited question" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(edited)));
    render(<MessageQueue chatId="chat-1" messages={[queuedMessage]} />, { wrapper: withQueryClient() });

    await userEvent.click(screen.getByLabelText("Edit Second question"));
    const textarea = screen.getByLabelText("Edit queued message");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Edited question");
    await userEvent.click(screen.getByText("Save"));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/chats/chat-1/messages/msg-2"),
        expect.objectContaining({ method: "PATCH" })
      )
    );
  });

  it("another member's queued message is shown with its author but cannot be edited or canceled", () => {
    vi.stubGlobal("fetch", vi.fn());
    const theirs: Message = { ...queuedMessage, authorId: "guest", authorEmail: "guest@example.com" };
    render(<MessageQueue chatId="chat-1" messages={[theirs]} currentUserId="me" />, { wrapper: withQueryClient() });

    expect(screen.getByText("guest@example.com")).toBeInTheDocument();
    expect(screen.queryByLabelText("Edit Second question")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Cancel Second question")).not.toBeInTheDocument();
  });
});
