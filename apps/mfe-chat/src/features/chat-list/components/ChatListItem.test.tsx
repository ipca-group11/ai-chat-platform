import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Chat } from "../../../shared/types";
import { ChatListItem } from "./ChatListItem";

const chat: Chat = {
  id: "chat-1",
  title: "First chat",
  ownerId: "user-1",
  provider: "anthropic",
  model: "claude-3-5-haiku-latest",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("ChatListItem (AC-42)", () => {
  it("AC-42: opens the chat when clicked", async () => {
    const onOpen = vi.fn();
    render(<ChatListItem chat={chat} onOpen={onOpen} onRename={vi.fn()} onDelete={vi.fn()} />);

    await userEvent.click(screen.getByText("First chat"));

    expect(onOpen).toHaveBeenCalledWith("chat-1");
  });

  it("AC-42: renames the chat via the inline rename form", async () => {
    const onRename = vi.fn();
    render(<ChatListItem chat={chat} onOpen={vi.fn()} onRename={onRename} onDelete={vi.fn()} />);

    await userEvent.click(screen.getByLabelText("Rename First chat"));
    const input = screen.getByLabelText("Rename First chat");
    await userEvent.clear(input);
    await userEvent.type(input, "Renamed chat");
    await userEvent.click(screen.getByText("Save"));

    expect(onRename).toHaveBeenCalledWith("chat-1", "Renamed chat");
  });

  it("cancels the rename form without calling onRename", async () => {
    const onRename = vi.fn();
    render(<ChatListItem chat={chat} onOpen={vi.fn()} onRename={onRename} onDelete={vi.fn()} />);

    await userEvent.click(screen.getByLabelText("Rename First chat"));
    await userEvent.click(screen.getByText("Cancel"));

    expect(screen.queryByText("Save")).not.toBeInTheDocument();
    expect(onRename).not.toHaveBeenCalled();
  });

  it("AC-42: deletes the chat when the delete action is clicked", async () => {
    const onDelete = vi.fn();
    render(<ChatListItem chat={chat} active onOpen={vi.fn()} onRename={vi.fn()} onDelete={onDelete} />);

    await userEvent.click(screen.getByLabelText("Delete First chat"));

    expect(onDelete).toHaveBeenCalledWith("chat-1");
  });

  it("a chat shared with you shows its owner and cannot be renamed or deleted", () => {
    render(
      <ChatListItem
        chat={{ ...chat, ownerEmail: "owner@example.com" }}
        shared
        onOpen={vi.fn()}
        onRename={vi.fn()}
        onDelete={vi.fn()}
      />
    );

    expect(screen.getByLabelText("Shared with you")).toBeInTheDocument();
    expect(screen.getByText(/owner@example.com/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Rename First chat")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete First chat")).not.toBeInTheDocument();
  });
});
