import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@platform/test-utils";
import { http, HttpResponse, server } from "@platform/test-utils/msw";
import type { Chat } from "../../../shared/types";
import { ChatList } from "./ChatList";

const chatA: Chat = {
  id: "chat-1",
  title: "First chat",
  ownerId: "user-1",
  provider: "ollama",
  model: "llama3.2:1b",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ChatList (AC-42, AC-47)", () => {
  it("AC-42: renders the user's chats and opens one on click", async () => {
    server.use(http.get("*/chats", () => HttpResponse.json({ chats: [chatA] })));
    const onOpenChat = vi.fn();

    renderWithClient(<ChatList onOpenChat={onOpenChat} />);

    await screen.findByText("First chat");
    await userEvent.click(screen.getByText("First chat"));

    expect(onOpenChat).toHaveBeenCalledWith("chat-1");
  });

  it("AC-47: shows an empty state rather than inventing chats when the server returns none", async () => {
    server.use(http.get("*/chats", () => HttpResponse.json({ chats: [] })));

    renderWithClient(<ChatList onOpenChat={vi.fn()} />);

    await screen.findByText(/no chats yet/i);
  });

  it("AC-42: creating a chat via the dialog opens it once created", async () => {
    server.use(
      http.get("*/chats", () => HttpResponse.json({ chats: [] })),
      http.post("*/chats", () => HttpResponse.json({ chat: chatA }, { status: 201 })),
    );
    const onOpenChat = vi.fn();

    renderWithClient(<ChatList onOpenChat={onOpenChat} />);
    await screen.findByText(/no chats yet/i);

    await userEvent.click(screen.getByText("New chat"));
    // The dialog is loaded on the first open (AICHAT-239).
    await userEvent.type(await screen.findByLabelText("Chat title"), "First chat");
    await userEvent.click(screen.getByText("Create"));

    await waitFor(() => expect(onOpenChat).toHaveBeenCalledWith("chat-1"));
  });

  it("shows an error state when the chats request fails", async () => {
    server.use(http.get("*/chats", () => HttpResponse.json({ message: "boom" }, { status: 500 })));

    renderWithClient(<ChatList onOpenChat={vi.fn()} />);

    await screen.findByRole("alert");
  });
});
