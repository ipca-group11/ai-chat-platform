import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { configureAxe } from "vitest-axe";
import { renderWithClient } from "@platform/test-utils";
import { http, HttpResponse, server } from "@platform/test-utils/msw";
import type { Chat, Message } from "../../../shared/types";
import { ChatList } from "../../chat-list/components/ChatList";
import { ChatListItem } from "../../chat-list/components/ChatListItem";
import { NewChatDialog } from "../../chat-list/components/NewChatDialog";
import { Composer } from "../../composer/components/Composer";
import { MessageQueue } from "../../message-queue/components/MessageQueue";
import { MessageError } from "./MessageError";
import { MessageList } from "./MessageList";
import { ReasoningSection } from "./ReasoningSection";

vi.mock("../model/stream-registry", () => ({ ensureChatStream: vi.fn() }));

// Threshold: 0 serious/critical violations per component state, WCAG 2.2 AA rule set.
// jsdom has no layout, so colour contrast cannot be computed; it is covered by Lighthouse/Playwright axe.
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];
const BLOCKING = ["serious", "critical"];

const axe = configureAxe({
  runOnly: { type: "tag", values: WCAG_TAGS },
  rules: { "color-contrast": { enabled: false } },
});

async function blockingViolations(root: Element): Promise<string[]> {
  const results = await axe(root);
  return results.violations
    .filter((v) => BLOCKING.includes(v.impact ?? ""))
    .map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

/** Fails when the rendered state has any serious or critical WCAG 2.2 AA violation. */
async function expectNoBlockingViolations(root: Element = document.body): Promise<void> {
  expect(await blockingViolations(root)).toEqual([]);
}

const chat: Chat = {
  id: "chat-1",
  title: "First chat",
  ownerId: "user-1",
  provider: "ollama",
  model: "llama3.2:1b",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function msg(overrides: Partial<Message>): Message {
  return {
    id: "m1",
    chatId: "chat-1",
    role: "assistant",
    content: "Hello there",
    attachments: [],
    status: "sent",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("a11y: component states (axe, WCAG 2.2 AA, 0 serious/critical)", () => {
  it("the check fails on a serious violation", async () => {
    const { container } = render(<button type="button" />);
    expect(await blockingViolations(container)).not.toEqual([]);
  });

  it("ChatList: loaded, empty and error", async () => {
    server.use(http.get("*/chats", () => HttpResponse.json({ chats: [chat] })));
    const loaded = renderWithClient(<ChatList onOpenChat={vi.fn()} />);
    await screen.findByText("First chat");
    await expectNoBlockingViolations(loaded.container);
    loaded.unmount();

    server.use(http.get("*/chats", () => HttpResponse.json({ chats: [] })));
    const empty = renderWithClient(<ChatList onOpenChat={vi.fn()} />);
    await screen.findByText(/no chats yet/i);
    await expectNoBlockingViolations(empty.container);
    empty.unmount();

    server.use(http.get("*/chats", () => HttpResponse.json({ message: "boom" }, { status: 500 })));
    const failed = renderWithClient(<ChatList onOpenChat={vi.fn()} />);
    await waitFor(() => expect(failed.container.textContent).toMatch(/fail|error|could not|couldn't/i));
    await expectNoBlockingViolations(failed.container);
  });

  it("ChatListItem: default, active, shared and renaming", async () => {
    const props = { chat, onOpen: vi.fn(), onRename: vi.fn(), onDelete: vi.fn() };
    for (const extra of [{}, { active: true }, { shared: true }, { onOpenInSplit: vi.fn() }]) {
      const { container, unmount } = render(
        <ul>
          <ChatListItem {...props} {...extra} />
        </ul>,
      );
      await expectNoBlockingViolations(container);
      unmount();
    }
    const { container } = render(
      <ul>
        <ChatListItem {...props} />
      </ul>,
    );
    await userEvent.click(screen.getByRole("button", { name: /rename/i }));
    await expectNoBlockingViolations(container);
  });

  it("NewChatDialog: open and submitting", async () => {
    const { rerender } = render(<NewChatDialog open onClose={vi.fn()} onCreate={vi.fn()} />);
    await screen.findByRole("dialog");
    await expectNoBlockingViolations();
    rerender(<NewChatDialog open onClose={vi.fn()} onCreate={vi.fn()} submitting />);
    await expectNoBlockingViolations();
  });

  it("MessageList: empty and every message status", async () => {
    const handlers = { onStop: vi.fn(), onRetry: vi.fn() };
    const empty = render(<MessageList messages={[]} {...handlers} />);
    await expectNoBlockingViolations(empty.container);
    empty.unmount();

    const messages = [
      msg({ id: "1", role: "user", content: "Hi", authorId: "user-1" }),
      msg({ id: "2", content: "**Bold** and\n\n- one\n- two", reasoning: "Thinking it over" }),
      msg({ id: "3", status: "streaming", content: "Partial" }),
      msg({ id: "4", status: "queued", role: "user", content: "Later" }),
      msg({ id: "5", status: "failed", content: "", error: "Provider timed out" }),
    ];
    const { container } = render(<MessageList messages={messages} currentUserId="user-1" {...handlers} />);
    await expectNoBlockingViolations(container);
  });

  it("MessageError: failed and retrying", async () => {
    const failed = msg({ status: "failed", error: "Rate limited" });
    const { container, rerender } = render(<MessageError message={failed} onRetry={vi.fn()} />);
    await expectNoBlockingViolations(container);
    rerender(<MessageError message={failed} onRetry={vi.fn()} retrying />);
    await expectNoBlockingViolations(container);
  });

  it("ReasoningSection: thinking (expanded) and done (collapsed)", async () => {
    const { container, rerender } = render(<ReasoningSection reasoning="Step one" thinking />);
    await expectNoBlockingViolations(container);
    rerender(<ReasoningSection reasoning="Step one" thinking={false} />);
    await expectNoBlockingViolations(container);
  });

  it("Composer: idle and compact", async () => {
    const props = { chatId: "chat-1", userId: "user-1", provider: "ollama" as const, model: "llama3.2:1b" };
    const idle = renderWithClient(<Composer {...props} />);
    await expectNoBlockingViolations(idle.container);
    idle.unmount();
    const compact = renderWithClient(<Composer {...props} compact />);
    await expectNoBlockingViolations(compact.container);
  });

  it("MessageQueue: queued messages", async () => {
    const queued = [msg({ id: "q1", role: "user", status: "queued", content: "Second question", authorId: "user-1" })];
    const { container } = renderWithClient(<MessageQueue chatId="chat-1" messages={queued} currentUserId="user-1" />);
    await expectNoBlockingViolations(container);
  });
});
