import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@platform/test-utils";
import { jsonResponse } from "../../../test/utils";
import type { Chat } from "../../../shared/types";
import { ChatList } from "./ChatList";

const chatA: Chat = {
  id: "chat-1",
  title: "First chat",
  ownerId: "user-1",
  provider: "anthropic",
  model: "claude-3-5-haiku-latest",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ChatList (AC-42, AC-47)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-42: renders the user's chats and opens one on click", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([chatA])));
    const onOpenChat = vi.fn();

    renderWithClient(<ChatList onOpenChat={onOpenChat} />);

    await screen.findByText("First chat");
    await userEvent.click(screen.getByText("First chat"));

    expect(onOpenChat).toHaveBeenCalledWith("chat-1");
  });

  it("AC-47: shows an empty state rather than inventing chats when the server returns none", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    renderWithClient(<ChatList onOpenChat={vi.fn()} />);

    await screen.findByText(/no chats yet/i);
  });

  it("AC-42: creating a chat via the dialog opens it once created", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(chatA, 201));
    vi.stubGlobal("fetch", fetchMock);
    const onOpenChat = vi.fn();

    renderWithClient(<ChatList onOpenChat={onOpenChat} />);
    await screen.findByText(/no chats yet/i);

    await userEvent.click(screen.getByText("New chat"));
    await userEvent.type(screen.getByLabelText("Chat title"), "First chat");
    await userEvent.click(screen.getByText("Create"));

    await waitFor(() => expect(onOpenChat).toHaveBeenCalledWith("chat-1"));
  });

  it("shows an error state when the chats request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "boom" }, 500)));

    renderWithClient(<ChatList onOpenChat={vi.fn()} />);

    await screen.findByRole("alert");
  });
});
