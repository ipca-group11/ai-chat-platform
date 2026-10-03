import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, withQueryClient } from "../../../test/utils";
import type { Message } from "../../../shared/types";
import { Composer } from "./Composer";

vi.mock("../../chat-view/model/stream-registry", () => ({
  ensureChatStream: vi.fn(),
}));

const sentMessage: Message = {
  id: "msg-1",
  chatId: "chat-1",
  role: "user",
  content: "Hello",
  attachments: [],
  status: "sent",
  createdAt: "2026-01-01T00:00:00.000Z",
};

describe("Composer (AC-51, AC-66)", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("AC-51: sends a typed message and clears the input", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(sentMessage, 201)));

    render(<Composer chatId="chat-1" userId="user-1" provider="ollama" model="llama3.2:1b" />, {
      wrapper: withQueryClient(),
    });

    const textbox = screen.getByLabelText("Message");
    await userEvent.type(textbox, "Hello");
    await userEvent.click(screen.getByText("Send"));

    await waitFor(() => expect(textbox).toHaveValue(""));
  });

  it("the Send button is disabled while the message is empty and there are no attachments", () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<Composer chatId="chat-1" userId="user-1" provider="ollama" model="llama3.2:1b" />, {
      wrapper: withQueryClient(),
    });

    expect(screen.getByText("Send")).toBeDisabled();
  });

  it("AC-51: sends on Enter (without Shift) without inserting a newline", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(sentMessage, 201)));

    render(<Composer chatId="chat-1" userId="user-1" provider="ollama" model="llama3.2:1b" />, {
      wrapper: withQueryClient(),
    });

    const textbox = screen.getByLabelText("Message");
    await userEvent.type(textbox, "Hello{Enter}");

    await waitFor(() => expect(textbox).toHaveValue(""));
  });

  it("shows the send error when the message fails to send", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Server error" }), { status: 500 })));

    render(<Composer chatId="chat-1" userId="user-1" provider="ollama" model="llama3.2:1b" />, {
      wrapper: withQueryClient(),
    });

    await userEvent.type(screen.getByLabelText("Message"), "Hello");
    await userEvent.click(screen.getByText("Send"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Server error");
  });

  it("AC-68: a rejected attachment blocks sending until it is removed", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<Composer chatId="chat-1" userId="user-1" provider="ollama" model="llama3.2:1b" />, {
      wrapper: withQueryClient(),
    });

    await userEvent.type(screen.getByLabelText("Message"), "Hello");
    const file = new File([new Uint8Array(11 * 1024 * 1024)], "big.txt", { type: "text/plain" });
    await userEvent.upload(screen.getByLabelText("Attach a file"), file);

    expect(screen.getByText("Send")).toBeDisabled();

    await userEvent.click(screen.getByLabelText("Remove big.txt"));
    await waitFor(() => expect(screen.getByText("Send")).toBeEnabled());
  });
});
