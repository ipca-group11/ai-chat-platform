import { act, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FakeEventSource, installFakeEventSource, renderWithClient } from "@platform/test-utils";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import type { Chat, Message } from "../../../shared/types";
import { __resetShowReasoningForTests } from "../model/show-reasoning";
import { __resetStreamRegistryForTests } from "../model/stream-registry";
import { ChatView } from "./ChatView";

const chat: Chat = {
  id: "chat-1",
  title: "My chat",
  ownerId: "user-1",
  provider: "anthropic",
  model: "claude-3-5-haiku-latest",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const message: Message = {
  id: "msg-1",
  chatId: "chat-1",
  role: "user",
  content: "Hi",
  attachments: [],
  status: "sent",
  createdAt: "2026-01-01T00:00:00.000Z",
};

/** Serves one chat, its history and (like the service) the PATCH that changes the chat. */
function serveChat(current: Chat, messages: Message[] = []) {
  server.use(
    http.get("*/chats/:chatId", () => HttpResponse.json({ chat: current })),
    http.get("*/chats/:chatId/messages", () => HttpResponse.json({ messages })),
    http.patch("*/chats/:chatId", async ({ request }) =>
      HttpResponse.json({ chat: { ...current, ...((await request.json()) as Partial<Chat>) } })
    )
  );
}

const calls = (requests: Request[]) => requests.map((r) => `${r.method} ${new URL(r.url).pathname}`);

describe("ChatView (AC-46, AC-51..AC-55)", () => {
  beforeEach(() => {
    installFakeEventSource();
  });

  afterEach(() => {
    // The registry lives at module level; without this the next test finds the stream already open.
    __resetStreamRegistryForTests();
  });

  it("renders chat header, history and the composer once loaded", async () => {
    serveChat(chat, [message]);

    renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);

    expect(await screen.findByText("My chat")).toBeInTheDocument();
    expect(await screen.findByText("Hi")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
  });

  it("AC-52: shows a token pushed by the stream as soon as it arrives", async () => {
    serveChat(chat, [message]);
    renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);
    await screen.findByText("Hi");

    act(() => FakeEventSource.last.emit("token", { messageId: "msg-9", token: "Hello there" }));

    expect(await screen.findByText("Hello there")).toBeInTheDocument();
  });

  it("AC-54: stops a streaming message and AC-73: retries a failed one", async () => {
    const streamingMessage: Message = { ...message, id: "msg-2", role: "assistant", status: "streaming" };
    const failedMessage: Message = {
      ...message,
      id: "msg-3",
      role: "assistant",
      status: "failed",
      error: "Rate limited",
    };
    serveChat(chat, [streamingMessage, failedMessage]);
    server.use(
      http.post("*/chats/:chatId/messages/:messageId/stop", () => HttpResponse.json({ stopped: true })),
      http.post("*/chats/:chatId/messages/:messageId/retry", () => HttpResponse.json({ message }, { status: 202 }))
    );
    const requests = recordRequests();

    renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);

    await userEvent.click(await screen.findByText("Stop"));
    await waitFor(() => expect(calls(requests)).toContain("POST /api/chats/chat-1/messages/msg-2/stop"));

    await userEvent.click(screen.getByText("Retry"));
    await waitFor(() => expect(calls(requests)).toContain("POST /api/chats/chat-1/messages/msg-3/retry"));
  });

  it("AC-46: shows a clear not-found state instead of any chat data on a 403/404", async () => {
    server.use(
      http.get("*/chats/:chatId", () => HttpResponse.json({ message: "Forbidden" }, { status: 403 })),
      http.get("*/chats/:chatId/messages", () => HttpResponse.json({ message: "Forbidden" }, { status: 403 }))
    );

    renderWithClient(<ChatView chatId="chat-owned-by-another-user" userId="user-1" />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/not found/i);
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
  });

  describe("reasoning toggle", () => {
    const reasoningChat: Chat = { ...chat, model: "claude-sonnet-5-5", reasoning: false };

    it("lets the owner turn reasoning on for a model that supports it", async () => {
      serveChat(reasoningChat);
      const requests = recordRequests();
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);

      const toggle = await screen.findByRole("button", { name: "Reasoning" });
      expect(toggle).toHaveAttribute("aria-pressed", "false");
      await userEvent.click(toggle);

      await waitFor(() => expect(calls(requests)).toContain("PATCH /api/chats/chat-1"));
      expect(await requests.find((r) => r.method === "PATCH")!.json()).toEqual({ reasoning: true });
      await waitFor(() => expect(screen.getByRole("button", { name: "Reasoning" })).toHaveAttribute("aria-pressed", "true"));
    });

    it("shows members the setting without letting them change it", async () => {
      serveChat({ ...reasoningChat, reasoning: true });
      renderWithClient(<ChatView chatId="chat-1" userId="someone-else" />);

      const toggle = await screen.findByRole("button", { name: "Reasoning" });
      expect(toggle).toHaveAttribute("aria-pressed", "true");
      expect(toggle).toBeDisabled();
    });

    it("is hidden for models that can't reason", async () => {
      serveChat(chat);
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);

      expect(await screen.findByText("My chat")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Reasoning" })).not.toBeInTheDocument();
    });
  });

  describe("show thinking", () => {
    beforeEach(() => {
      window.localStorage.clear();
      __resetShowReasoningForTests();
    });

    it("hides and shows the model's reasoning, and remembers the choice", async () => {
      const reply: Message = { ...message, id: "msg-2", role: "assistant", content: "Answer", reasoning: "Because" };
      serveChat({ ...chat, model: "claude-sonnet-5-5", reasoning: true }, [reply]);
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);

      expect(await screen.findByRole("button", { name: "Thinking" })).toBeInTheDocument();
      const toggle = screen.getByRole("button", { name: "Show thinking" });
      expect(toggle).toHaveAttribute("aria-pressed", "true");

      await userEvent.click(toggle);

      expect(screen.queryByRole("button", { name: "Thinking" })).not.toBeInTheDocument();
      expect(screen.getByText("Answer")).toBeInTheDocument();
      expect(window.localStorage.getItem("chat.showReasoning")).toBe("false");
    });
  });

  describe("web fetch toggle", () => {
    const claudeChat: Chat = { ...chat, provider: "anthropic", model: "claude-opus-5-5", webFetch: false };

    it("lets the owner turn web fetch on for a model that supports it", async () => {
      serveChat(claudeChat);
      const requests = recordRequests();
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);

      const toggle = await screen.findByRole("button", { name: "Web fetch" });
      expect(toggle).toHaveAttribute("aria-pressed", "false");
      await userEvent.click(toggle);

      await waitFor(() => expect(calls(requests)).toContain("PATCH /api/chats/chat-1"));
      expect(await requests.find((r) => r.method === "PATCH")!.json()).toEqual({ webFetch: true });
      await waitFor(() => expect(screen.getByRole("button", { name: "Web fetch" })).toHaveAttribute("aria-pressed", "true"));
    });

    it("is read-only for members and hidden for models that can't fetch", async () => {
      serveChat({ ...claudeChat, webFetch: true });
      const { unmount } = renderWithClient(<ChatView chatId="chat-1" userId="someone-else" />);
      const toggle = await screen.findByRole("button", { name: "Web fetch" });
      expect(toggle).toHaveAttribute("aria-pressed", "true");
      expect(toggle).toBeDisabled();
      unmount();

      serveChat(chat);
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);
      expect(await screen.findByText("My chat")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Web fetch" })).not.toBeInTheDocument();
    });
  });

  it("sends the session's API key when retrying a failed reply", async () => {
    window.sessionStorage.setItem("llm-api-key-session:user-1:anthropic", "sk-ant-session");
    const failed: Message = { ...message, id: "msg-2", role: "assistant", content: "", status: "failed", error: "Boom" };
    serveChat({ ...chat, provider: "anthropic", model: "claude-opus-5-5" }, [failed]);
    server.use(
      http.post("*/chats/:chatId/messages/:messageId/retry", () =>
        HttpResponse.json({ message: { ...failed, status: "streaming", error: null } }, { status: 202 })
      )
    );
    const requests = recordRequests();
    renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);

    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

    await waitFor(() => {
      const retry = requests.find((r) => r.url.includes("/retry"));
      expect(retry?.headers.get("X-Llm-Api-Key")).toBe("sk-ant-session");
    });
    window.sessionStorage.clear();
  });
});
