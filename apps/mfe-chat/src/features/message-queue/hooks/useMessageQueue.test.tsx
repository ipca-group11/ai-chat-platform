import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderHookWithClient } from "@platform/test-utils";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";

vi.mock("../../chat-view/model/stream-registry", () => ({ ensureChatStream: vi.fn() }));

import { useMessageQueue } from "./useMessageQueue";

describe("useMessageQueue (AC-58)", () => {
  it("edits a queued message of the chat with the new content", async () => {
    const requests = recordRequests();
    let body: unknown;
    server.use(
      http.patch("*/chats/:chatId/messages/:messageId", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          message: { id: "msg-2", chatId: "chat-1", role: "user", content: "Better", attachments: [], status: "queued", createdAt: "2026-01-01T00:00:00.000Z" },
        });
      })
    );
    const { result } = renderHookWithClient(() => useMessageQueue("chat-1"));

    act(() => result.current.editMessage("msg-2", "Better"));

    await waitFor(() => expect(result.current.isEditing).toBe(false));
    await waitFor(() => expect(body).toEqual({ content: "Better" }));
    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual(["PATCH /api/chats/chat-1/messages/msg-2"]);
  });

  it("cancels a queued message of the chat", async () => {
    const requests = recordRequests();
    const { result } = renderHookWithClient(() => useMessageQueue("chat-1"));

    act(() => result.current.cancelMessage("msg-2"));

    await waitFor(() =>
      expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual(["DELETE /api/chats/chat-1/messages/msg-2"])
    );
    await waitFor(() => expect(result.current.isCanceling).toBe(false));
  });

  it("reports the pending state while a request is in flight", async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    server.use(
      http.delete("*/chats/:chatId/messages/:messageId", async () => {
        await gate;
        return new HttpResponse(null, { status: 204 });
      })
    );
    const { result } = renderHookWithClient(() => useMessageQueue("chat-1"));
    expect(result.current.isCanceling).toBe(false);

    act(() => result.current.cancelMessage("msg-2"));
    await waitFor(() => expect(result.current.isCanceling).toBe(true));
    expect(result.current.isEditing).toBe(false);

    release();
    await waitFor(() => expect(result.current.isCanceling).toBe(false));
  });
});
