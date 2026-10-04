import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Message } from "../../../shared/types";
import { QueuedMessageItem } from "./QueuedMessageItem";

const message: Message = {
  id: "msg-2",
  chatId: "chat-1",
  role: "user",
  content: "Second question",
  attachments: [],
  status: "queued",
  createdAt: "2026-01-01T00:01:00.000Z",
};

function setup(props: Partial<React.ComponentProps<typeof QueuedMessageItem>> = {}) {
  const onEdit = vi.fn();
  const onCancel = vi.fn();
  render(
    <ul>
      <QueuedMessageItem message={message} onEdit={onEdit} onCancel={onCancel} {...props} />
    </ul>
  );
  return { onEdit, onCancel };
}

describe("QueuedMessageItem (AC-57, AC-58)", () => {
  it("shows the queued text with buttons named after it", () => {
    setup();

    expect(screen.getByText("Second question")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Second question" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel Second question" })).toBeInTheDocument();
  });

  it("cancels the message by id", async () => {
    const { onCancel } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Cancel Second question" }));

    expect(onCancel).toHaveBeenCalledWith("msg-2");
  });

  it("edits in place and saves the new content", async () => {
    const { onEdit } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Edit Second question" }));
    const field = screen.getByRole("textbox", { name: "Edit queued message" });
    expect(field).toHaveValue("Second question");
    await userEvent.clear(field);
    await userEvent.type(field, "Third question");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onEdit).toHaveBeenCalledWith("msg-2", "Third question");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("leaves the message alone when the edit is abandoned", async () => {
    const { onEdit } = setup();

    await userEvent.click(screen.getByRole("button", { name: "Edit Second question" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Edit queued message" }), " changed");
    await userEvent.click(screen.getByRole("button", { name: "Cancel edit" }));

    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.getByText("Second question")).toBeInTheDocument();
  });

  it("shows another member's message with their email and no edit or cancel buttons", () => {
    setup({ editable: false, message: { ...message, authorEmail: "guest@example.test" } });

    expect(screen.getByText("Second question")).toBeInTheDocument();
    expect(screen.getByText("guest@example.test")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows no author line for a read-only message without an email", () => {
    setup({ editable: false });

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("listitem")).toHaveTextContent(/^Second question$/);
  });
});
