import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NewChatDialog } from "./NewChatDialog";

describe("NewChatDialog (AC-42, AC-48)", () => {
  it("renders nothing when closed", () => {
    const { container } = render(<NewChatDialog open={false} onClose={vi.fn()} onCreate={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("AC-48: lets the user change the provider/model before creating", async () => {
    const onCreate = vi.fn();
    render(<NewChatDialog open onClose={vi.fn()} onCreate={onCreate} />);

    await userEvent.type(screen.getByLabelText("Chat title"), "New chat");
    await userEvent.click(screen.getByLabelText("Provider"));
    await userEvent.click(await screen.findByRole("option", { name: "OpenAI" }));
    await userEvent.click(screen.getByText("Create"));

    expect(onCreate).toHaveBeenCalledWith({ title: "New chat", provider: "openai", model: "gpt-4o" });
  });

  it("closes the dialog via Cancel", async () => {
    const onClose = vi.fn();
    render(<NewChatDialog open onClose={onClose} onCreate={vi.fn()} />);

    await userEvent.click(screen.getByText("Cancel"));

    expect(onClose).toHaveBeenCalled();
  });

  it("does not submit when the title is blank", async () => {
    const onCreate = vi.fn();
    render(<NewChatDialog open onClose={vi.fn()} onCreate={onCreate} />);

    expect(screen.getByText("Create")).toBeDisabled();
  });

  it("offers reasoning for models that support it and sends the choice", async () => {
    const onCreate = vi.fn();
    render(<NewChatDialog open onClose={vi.fn()} onCreate={onCreate} />);
    expect(screen.queryByRole("checkbox", { name: /Reasoning/ })).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Chat title"), "Thinking chat");
    await userEvent.click(screen.getByLabelText("Model"));
    await userEvent.click(await screen.findByRole("option", { name: "qwen3:4b" }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Reasoning/ }));
    await userEvent.click(screen.getByText("Create"));

    expect(onCreate).toHaveBeenCalledWith({ title: "Thinking chat", provider: "ollama", model: "qwen3:4b", reasoning: true });
  });

  it("offers web fetch for models that support it and sends the choice", async () => {
    const onCreate = vi.fn();
    render(<NewChatDialog open onClose={vi.fn()} onCreate={onCreate} />);
    expect(screen.queryByRole("checkbox", { name: /Web fetch/ })).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Chat title"), "Research");
    await userEvent.click(screen.getByLabelText("Provider"));
    await userEvent.click(await screen.findByRole("option", { name: /anthropic/i }));
    await userEvent.click(screen.getByRole("checkbox", { name: /Web fetch/ }));
    await userEvent.click(screen.getByText("Create"));

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ provider: "anthropic", webFetch: true }));
  });
});
