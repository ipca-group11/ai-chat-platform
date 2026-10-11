import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { createTestQueryClient, FakeEventSource, installFakeEventSource } from "@platform/test-utils";
import { queryKeys } from "../../shared/query-keys";
import type { Message } from "../../shared/types";
import { MessageList } from "../chat-view/components/MessageList";
import { __resetStreamRegistryForTests, ensureChatStream } from "../chat-view/model/stream-registry";

// Requirement: UI stays responsive with >= 5 chats streaming at once.
const STREAMS = 5;
const TOKENS_PER_STREAM = 500;
const P95_BUDGET_MS = 50;

function token(chat: number, i: number): string {
  return `c${chat}t${i} `;
}

function percentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)] ?? 0;
}

function ChatPane({ chatId }: { chatId: string }) {
  const { data = [] } = useQuery<Message[]>({
    queryKey: queryKeys.messages(chatId),
    queryFn: () => new Promise<Message[]>(() => undefined),
    enabled: false,
  });
  return (
    <section data-testid={`pane-${chatId}`}>
      <MessageList messages={data} onStop={() => undefined} onRetry={() => undefined} />
    </section>
  );
}

describe("streaming performance: 5 concurrent streams x 500 tokens", () => {
  beforeEach(() => {
    installFakeEventSource();
  });

  afterEach(() => {
    __resetStreamRegistryForTests();
    vi.unstubAllGlobals();
  });

  it("keeps the render batch p95 under 50ms and drops no token", () => {
    const queryClient = createTestQueryClient();
    const chatIds = Array.from({ length: STREAMS }, (_, n) => `perf-chat-${n}`);
    chatIds.forEach((id) => ensureChatStream(id, queryClient));
    expect(FakeEventSource.instances).toHaveLength(STREAMS);

    const view = render(
      <QueryClientProvider client={queryClient}>
        {chatIds.map((id) => (
          <ChatPane key={id} chatId={id} />
        ))}
      </QueryClientProvider>,
    );

    // One batch = one token delivered on every stream, rendered to the DOM (a frame's worth of work).
    const batchMs: number[] = [];
    for (let i = 0; i < TOKENS_PER_STREAM; i++) {
      const start = performance.now();
      act(() => {
        FakeEventSource.instances.forEach((source, n) => {
          source.emit("token", { messageId: `reply-${n}`, token: token(n, i) });
        });
      });
      batchMs.push(performance.now() - start);
    }

    const p95 = percentile(batchMs, 0.95);
    console.info(
      `[streaming-perf] batches=${batchMs.length} p50=${percentile(batchMs, 0.5).toFixed(2)}ms p95=${p95.toFixed(2)}ms max=${Math.max(...batchMs).toFixed(2)}ms`,
    );

    // Zero dropped tokens: cache and DOM hold every token, in order, for every chat.
    chatIds.forEach((id, n) => {
      const expected = Array.from({ length: TOKENS_PER_STREAM }, (_, i) => token(n, i)).join("");
      const [message] = queryClient.getQueryData<Message[]>(queryKeys.messages(id)) ?? [];
      expect(message?.content).toBe(expected);
      const rendered = view.getByTestId(`pane-${id}`).textContent ?? "";
      expect(rendered).toContain(token(n, 0).trim());
      expect(rendered).toContain(token(n, TOKENS_PER_STREAM - 1).trim());
    });

    expect(p95).toBeLessThan(P95_BUDGET_MS);
  });
});
