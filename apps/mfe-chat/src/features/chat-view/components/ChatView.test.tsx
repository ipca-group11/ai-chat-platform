import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestQueryClient, FakeEventSource, installFakeEventSource, renderWithClient } from "@platform/test-utils";
import { delay, http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { queryKeys } from "../../../shared/query-keys";
import type { Chat, Message } from "../../../shared/types";
import { expectNoA11yViolations } from "../../../test/a11y";
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

/** useChat retries a 5xx twice with a delay; waiting out the real delay (3 s) would only slow the test. */
function clientWithoutRetryDelay() {
  const queryClient = createTestQueryClient();
  queryClient.setQueryDefaults(queryKeys.chat("chat-1"), { retryDelay: 0 });
  return queryClient;
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

  describe("loading and error states", () => {
    it("shows the skeleton with a screen-reader label while the chat loads, then the chat", async () => {
      server.use(
        http.get("*/chats/:chatId", async () => {
          await delay(150);
          return HttpResponse.json({ chat });
        }),
        http.get("*/chats/:chatId/messages", () => HttpResponse.json({ messages: [] }))
      );
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);

      expect(screen.getByText("Loading chat…")).toBeInTheDocument();
      expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();

      expect(await screen.findByRole("heading", { name: "My chat" })).toBeInTheDocument();
      expect(screen.queryByText("Loading chat…")).not.toBeInTheDocument();
    });

    it("a server error on the chat shows 'Could not load this chat', not the not-found text", async () => {
      server.use(
        http.get("*/chats/:chatId", () => HttpResponse.json({ message: "Boom" }, { status: 500 })),
        http.get("*/chats/:chatId/messages", () => HttpResponse.json({ messages: [] }))
      );
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" />, { queryClient: clientWithoutRetryDelay() });

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("Could not load this chat");
      expect(alert).toHaveTextContent(/something went wrong/i);
      expect(alert).not.toHaveTextContent(/not found/i);
      expect(screen.queryByLabelText("Message")).not.toBeInTheDocument();
    });

    it("the error state still offers the close button of a split pane", async () => {
      const onClose = vi.fn();
      server.use(http.get("*/chats/:chatId", () => HttpResponse.json({ message: "Boom" }, { status: 500 })));
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" onClose={onClose} />, {
        queryClient: clientWithoutRetryDelay(),
      });

      await userEvent.click(await screen.findByRole("button", { name: "Close pane" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("keeps the chat usable and shows 'Could not load messages.' when only the history fails", async () => {
      serveChat(chat);
      server.use(http.get("*/chats/:chatId/messages", () => HttpResponse.json({ message: "Boom" }, { status: 500 })));
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);

      expect(await screen.findByRole("alert")).toHaveTextContent("Could not load messages.");
      expect(screen.getByRole("heading", { name: "My chat" })).toBeInTheDocument();
      expect(screen.getByLabelText("Message")).toBeEnabled();
    });
  });

  describe("live stream", () => {
    const reasoningChat: Chat = { ...chat, model: "claude-sonnet-5-5", reasoning: true, webFetch: true };

    beforeEach(() => {
      window.localStorage.clear();
      __resetShowReasoningForTests();
    });

    it("has no accessibility violations in its main state", async () => {
      serveChat(chat, [message]);
      const { container } = renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);
      await screen.findByText("Hi");

      await expectNoA11yViolations(container);
    });

    it("AC-52: shows each streamed token as it arrives, then the finished reply", async () => {
      serveChat(chat, [message]);
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);
      await screen.findByText("Hi");

      act(() => FakeEventSource.last.emit("token", { type: "token", messageId: "reply-1", token: "Hel" }));
      expect(await screen.findByText("Hel")).toBeInTheDocument();
      act(() => FakeEventSource.last.emit("token", { type: "token", messageId: "reply-1", token: "lo there" }));
      expect(await screen.findByText("Hello there")).toBeInTheDocument();
      expect(screen.getByTestId("assistant-message")).toHaveAttribute("data-status", "streaming");

      serveChat(chat, [message, { ...message, id: "reply-1", role: "assistant", content: "Hello there" }]);
      act(() => FakeEventSource.last.emit("done", { type: "done", messageId: "reply-1" }));
      await waitFor(() => expect(screen.getByTestId("assistant-message")).toHaveAttribute("data-status", "sent"));
      expect(screen.getByText("Hello there")).toBeInTheDocument();
    });

    it("shows the reasoning while the model thinks, collapsed once the answer starts", async () => {
      serveChat(reasoningChat, [message]);
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);
      await screen.findByText("Hi");

      act(() => FakeEventSource.last.emit("reasoning", { type: "reasoning", messageId: "reply-1", token: "Let me " }));
      act(() => FakeEventSource.last.emit("reasoning", { type: "reasoning", messageId: "reply-1", token: "think." }));

      const region = await screen.findByRole("region", { name: "Model reasoning" });
      expect(region).toHaveTextContent("Let me think.");
      expect(screen.getByRole("button", { name: "Thinking…", expanded: true })).toBeInTheDocument();

      act(() => FakeEventSource.last.emit("token", { type: "token", messageId: "reply-1", token: "The answer" }));

      expect(await screen.findByText("The answer")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Thinking", expanded: false })).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: "Model reasoning" })).not.toBeInTheDocument();
    });

    it("shows a page the model fetches, first in progress and then read", async () => {
      serveChat(reasoningChat, [message]);
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);
      await screen.findByText("Hi");
      const fetching = { id: "f1", url: "https://www.example.com/docs", status: "fetching" };

      act(() => FakeEventSource.last.emit("web_fetch", { type: "web_fetch", messageId: "reply-1", fetch: fetching }));
      const list = await screen.findByRole("list", { name: "Pages fetched" });
      expect(list).toHaveTextContent("Fetching example.com…");

      act(() =>
        FakeEventSource.last.emit("web_fetch", {
          type: "web_fetch",
          messageId: "reply-1",
          fetch: { ...fetching, status: "done", title: "Example docs" },
        })
      );
      const link = await within(list).findByRole("link", { name: "Example docs" });
      expect(link).toHaveAttribute("href", "https://www.example.com/docs");
      expect(list).not.toHaveTextContent("Fetching");
    });

    it("AC-72: a provider error in the middle of a reply keeps the partial text, shows the error and offers Retry", async () => {
      serveChat(chat, [message]);
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);
      await screen.findByText("Hi");

      act(() => FakeEventSource.last.emit("token", { type: "token", messageId: "reply-1", token: "Partial answer" }));
      expect(await screen.findByText("Partial answer")).toBeInTheDocument();
      // The error makes the view refetch, and the service has saved the failed reply by then.
      serveChat(chat, [
        message,
        { ...message, id: "reply-1", role: "assistant", content: "Partial answer", status: "failed", error: "Rate limited" },
      ]);
      act(() =>
        FakeEventSource.last.error({ type: "error", messageId: "reply-1", message: "Rate limited", retryable: true })
      );

      expect(await screen.findByTestId("message-error-reply-1")).toHaveTextContent("Rate limited");
      expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
      expect(screen.getByText("Partial answer")).toBeInTheDocument();
      expect(screen.getByLabelText("Message")).toBeEnabled();
    });

    it("a dropped connection does not break the view", async () => {
      serveChat(chat, [message]);
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);
      await screen.findByText("Hi");

      act(() => FakeEventSource.last.error());

      expect(screen.getByText("Hi")).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("header actions", () => {
    it("shows Back only when onBack is given and calls it", async () => {
      const onBack = vi.fn();
      serveChat(chat);
      const { unmount } = renderWithClient(<ChatView chatId="chat-1" userId="user-1" onBack={onBack} />);

      await userEvent.click(await screen.findByRole("button", { name: "Back to chats" }));
      expect(onBack).toHaveBeenCalledTimes(1);
      unmount();

      renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);
      await screen.findByRole("heading", { name: "My chat" });
      expect(screen.queryByRole("button", { name: "Back to chats" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Close pane" })).not.toBeInTheDocument();
    });

    it("closes the pane with the close button", async () => {
      const onClose = vi.fn();
      serveChat(chat);
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" onClose={onClose} />);

      await userEvent.click(await screen.findByRole("button", { name: "Close pane" }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("compact: keeps the actions as icon buttons without their text labels", async () => {
      serveChat(chat);
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" compact />);

      const share = await screen.findByRole("button", { name: "Share chat" });
      expect(share).not.toHaveTextContent("Share");
      expect(screen.getByLabelText("Message")).toHaveAttribute("rows", "1");
    });

    it("opens the members dialog from Share (owner) and closes it again", async () => {
      serveChat(chat);
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);

      await userEvent.click(await screen.findByRole("button", { name: "Share chat" }));

      const dialog = await screen.findByRole("dialog", { name: "Members" });
      expect(dialog).toHaveTextContent("Invite people to “My chat”");

      await userEvent.keyboard("{Escape}");
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("a member sees 'Chat members' instead of Share", async () => {
      serveChat(chat);
      renderWithClient(<ChatView chatId="chat-1" userId="someone-else" />);

      await userEvent.click(await screen.findByRole("button", { name: "Chat members" }));

      expect(await screen.findByRole("dialog", { name: "Members" })).toHaveTextContent("People with access to “My chat”");
    });
  });

  describe("toggle update", () => {
    const reasoningChat: Chat = { ...chat, model: "claude-sonnet-5-5", reasoning: false };

    it("shows the toggle as busy and disabled while the update is in flight", async () => {
      let answer!: () => void;
      const gate = new Promise<void>((resolve) => (answer = resolve));
      serveChat(reasoningChat);
      server.use(
        http.patch("*/chats/:chatId", async () => {
          await gate;
          return HttpResponse.json({ chat: { ...reasoningChat, reasoning: true } });
        })
      );
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);

      await userEvent.click(await screen.findByRole("button", { name: "Reasoning" }));

      const busy = await screen.findByRole("button", { name: "Reasoning", busy: true });
      expect(busy).toBeDisabled();
      answer();
      await waitFor(() => expect(screen.getByRole("button", { name: "Reasoning" })).toHaveAttribute("aria-pressed", "true"));
      expect(screen.getByRole("button", { name: "Reasoning" })).toBeEnabled();
    });

    it("a failed update leaves the toggle as it was and usable again", async () => {
      serveChat(reasoningChat);
      server.use(http.patch("*/chats/:chatId", () => HttpResponse.json({ message: "Boom" }, { status: 500 })));
      const requests = recordRequests();
      renderWithClient(<ChatView chatId="chat-1" userId="user-1" />);

      await userEvent.click(await screen.findByRole("button", { name: "Reasoning" }));

      await waitFor(() => expect(requests.some((r) => r.method === "PATCH")).toBe(true));
      const toggle = await screen.findByRole("button", { name: "Reasoning", busy: false });
      expect(toggle).toHaveAttribute("aria-pressed", "false");
      expect(toggle).toBeEnabled();
    });
  });
});
