import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, withQueryClient } from "../../../test/utils";
import type { Chat, Message } from "../../../shared/types";
import { __resetShowReasoningForTests } from "../model/show-reasoning";
import { ChatView } from "./ChatView";

class FakeEventSource {
  constructor(_url: string) {}
  addEventListener() {}
  close() {}
}

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

describe("ChatView (AC-46, AC-51..AC-55)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("EventSource", FakeEventSource);
  });

  it("renders chat header, history and the composer once loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url.includes("/messages")) return Promise.resolve(jsonResponse([message]));
        return Promise.resolve(jsonResponse(chat));
      })
    );

    render(<ChatView chatId="chat-1" userId="user-1" />, { wrapper: withQueryClient() });

    expect(await screen.findByText("My chat")).toBeInTheDocument();
    expect(await screen.findByText("Hi")).toBeInTheDocument();
    expect(screen.getByLabelText("Message")).toBeInTheDocument();
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
    const fetchMock = vi.fn((url: string, _init?: RequestInit) => {
      if (url.includes("/stop") || url.includes("/retry")) return Promise.resolve(jsonResponse({ ...message }));
      if (url.includes("/messages")) return Promise.resolve(jsonResponse([streamingMessage, failedMessage]));
      return Promise.resolve(jsonResponse(chat));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ChatView chatId="chat-1" userId="user-1" />, { wrapper: withQueryClient() });

    await userEvent.click(await screen.findByText("Stop"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/chats/chat-1/messages/msg-2/stop"),
        expect.objectContaining({ method: "POST" })
      )
    );

    await userEvent.click(screen.getByText("Retry"));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/chats/chat-1/messages/msg-3/retry"),
        expect.objectContaining({ method: "POST" })
      )
    );
  });

  it("AC-46: shows a clear not-found state instead of any chat data on a 403/404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "Forbidden" }, 403)));

    render(<ChatView chatId="chat-owned-by-another-user" userId="user-1" />, { wrapper: withQueryClient() });

    expect(await screen.findByRole("alert")).toHaveTextContent(/not found/i);
    expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
  });

  describe("reasoning toggle", () => {
    const reasoningChat: Chat = { ...chat, model: "claude-sonnet-5-5", reasoning: false };

    function stubFetch(current: Chat) {
      const fetchMock = vi.fn((url: string, init?: RequestInit) => {
        if (url.includes("/messages")) return Promise.resolve(jsonResponse([]));
        if (init?.method === "PATCH") {
          return Promise.resolve(jsonResponse({ ...current, ...(JSON.parse(init.body as string) as Partial<Chat>) }));
        }
        return Promise.resolve(jsonResponse(current));
      });
      vi.stubGlobal("fetch", fetchMock);
      return fetchMock;
    }

    it("lets the owner turn reasoning on for a model that supports it", async () => {
      const fetchMock = stubFetch(reasoningChat);
      render(<ChatView chatId="chat-1" userId="user-1" />, { wrapper: withQueryClient() });

      const toggle = await screen.findByRole("button", { name: "Reasoning" });
      expect(toggle).toHaveAttribute("aria-pressed", "false");
      await userEvent.click(toggle);

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/chats/chat-1"),
          expect.objectContaining({ method: "PATCH", body: JSON.stringify({ reasoning: true }) })
        )
      );
      await waitFor(() => expect(screen.getByRole("button", { name: "Reasoning" })).toHaveAttribute("aria-pressed", "true"));
    });

    it("shows members the setting without letting them change it", async () => {
      stubFetch({ ...reasoningChat, reasoning: true });
      render(<ChatView chatId="chat-1" userId="someone-else" />, { wrapper: withQueryClient() });

      const toggle = await screen.findByRole("button", { name: "Reasoning" });
      expect(toggle).toHaveAttribute("aria-pressed", "true");
      expect(toggle).toBeDisabled();
    });

    it("is hidden for models that can't reason", async () => {
      stubFetch(chat);
      render(<ChatView chatId="chat-1" userId="user-1" />, { wrapper: withQueryClient() });

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
      vi.stubGlobal(
        "fetch",
        vi.fn((url: string) => {
          if (url.includes("/messages")) return Promise.resolve(jsonResponse([reply]));
          return Promise.resolve(jsonResponse({ ...chat, model: "claude-sonnet-5-5", reasoning: true }));
        })
      );
      render(<ChatView chatId="chat-1" userId="user-1" />, { wrapper: withQueryClient() });

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
      const fetchMock = vi.fn((url: string, init?: RequestInit) => {
        if (url.includes("/messages")) return Promise.resolve(jsonResponse([]));
        if (init?.method === "PATCH") {
          return Promise.resolve(jsonResponse({ ...claudeChat, ...(JSON.parse(init.body as string) as Partial<Chat>) }));
        }
        return Promise.resolve(jsonResponse(claudeChat));
      });
      vi.stubGlobal("fetch", fetchMock);
      render(<ChatView chatId="chat-1" userId="user-1" />, { wrapper: withQueryClient() });

      const toggle = await screen.findByRole("button", { name: "Web fetch" });
      expect(toggle).toHaveAttribute("aria-pressed", "false");
      await userEvent.click(toggle);

      await waitFor(() =>
        expect(fetchMock).toHaveBeenCalledWith(
          expect.stringContaining("/chats/chat-1"),
          expect.objectContaining({ method: "PATCH", body: JSON.stringify({ webFetch: true }) })
        )
      );
      await waitFor(() => expect(screen.getByRole("button", { name: "Web fetch" })).toHaveAttribute("aria-pressed", "true"));
    });

    it("is read-only for members and hidden for models that can't fetch", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn((url: string) => Promise.resolve(jsonResponse(url.includes("/messages") ? [] : { ...claudeChat, webFetch: true })))
      );
      const { unmount } = render(<ChatView chatId="chat-1" userId="someone-else" />, { wrapper: withQueryClient() });
      const toggle = await screen.findByRole("button", { name: "Web fetch" });
      expect(toggle).toHaveAttribute("aria-pressed", "true");
      expect(toggle).toBeDisabled();
      unmount();

      vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(jsonResponse(url.includes("/messages") ? [] : chat))));
      render(<ChatView chatId="chat-1" userId="user-1" />, { wrapper: withQueryClient() });
      expect(await screen.findByText("My chat")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Web fetch" })).not.toBeInTheDocument();
    });
  });

  it("sends the session's API key when retrying a failed reply", async () => {
    window.sessionStorage.setItem("llm-api-key-session:user-1:anthropic", "sk-ant-session");
    const failed: Message = { ...message, id: "msg-2", role: "assistant", content: "", status: "failed", error: "Boom" };
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (url.includes("/retry")) return Promise.resolve(jsonResponse({ ...failed, status: "streaming", error: null }));
      if (url.includes("/messages")) return Promise.resolve(jsonResponse([failed]));
      void init;
      return Promise.resolve(jsonResponse({ ...chat, provider: "anthropic", model: "claude-opus-5-5" }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ChatView chatId="chat-1" userId="user-1" />, { wrapper: withQueryClient() });

    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

    await waitFor(() => {
      const retry = fetchMock.mock.calls.find(([url]) => url.includes("/retry"));
      expect(new Headers(retry?.[1]?.headers).get("X-Llm-Api-Key")).toBe("sk-ant-session");
    });
    window.sessionStorage.clear();
  });
});
