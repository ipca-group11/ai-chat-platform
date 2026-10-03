import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithClient } from "@platform/test-utils";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
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
  it("AC-57: shows only queued messages in a distinct queued section", () => {
    renderWithClient(<MessageQueue chatId="chat-1" messages={[sentMessage, queuedMessage]} />);

    expect(screen.getByText("Queued (1)")).toBeInTheDocument();
    expect(screen.getByText("Second question")).toBeInTheDocument();
    expect(screen.queryByText("First question")).not.toBeInTheDocument();
  });

  it("renders nothing when the queue is empty", () => {
    const { container } = renderWithClient(<MessageQueue chatId="chat-1" messages={[sentMessage]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("AC-58: cancels a queued message before it is processed", async () => {
    const requests = recordRequests();
    renderWithClient(<MessageQueue chatId="chat-1" messages={[queuedMessage]} />);

    await userEvent.click(screen.getByLabelText("Cancel Second question"));

    await waitFor(() =>
      expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toContain(
        "DELETE /api/chats/chat-1/messages/msg-2"
      )
    );
  });

  it("cancels the edit form without saving", async () => {
    const requests = recordRequests();
    renderWithClient(<MessageQueue chatId="chat-1" messages={[queuedMessage]} />);

    await userEvent.click(screen.getByLabelText("Edit Second question"));
    expect(screen.getByLabelText("Edit queued message")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Cancel edit"));

    expect(screen.queryByLabelText("Edit queued message")).not.toBeInTheDocument();
    expect(requests).toHaveLength(0);
  });

  it("AC-58: edits a queued message's content before it is processed", async () => {
    const edited = { ...queuedMessage, content: "Edited question" };
    server.use(http.patch("*/chats/:chatId/messages/:messageId", () => HttpResponse.json({ message: edited })));
    const requests = recordRequests();
    renderWithClient(<MessageQueue chatId="chat-1" messages={[queuedMessage]} />);

    await userEvent.click(screen.getByLabelText("Edit Second question"));
    const textarea = screen.getByLabelText("Edit queued message");
    await userEvent.clear(textarea);
    await userEvent.type(textarea, "Edited question");
    await userEvent.click(screen.getByText("Save"));

    await waitFor(() =>
      expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toContain(
        "PATCH /api/chats/chat-1/messages/msg-2"
      )
    );
    expect(await requests.find((r) => r.method === "PATCH")!.json()).toEqual({ content: "Edited question" });
  });

  it("another member's queued message is shown with its author but cannot be edited or canceled", () => {
    const theirs: Message = { ...queuedMessage, authorId: "guest", authorEmail: "guest@example.com" };
    renderWithClient(<MessageQueue chatId="chat-1" messages={[theirs]} currentUserId="me" />);

    expect(screen.getByText("guest@example.com")).toBeInTheDocument();
    expect(screen.queryByLabelText("Edit Second question")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Cancel Second question")).not.toBeInTheDocument();
  });
});
