import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createTestQueryClient, renderHookWithClient } from "@platform/test-utils";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { queryKeys } from "../../../shared/query-keys";
import type { Chat, ChatMember } from "../../../shared/types";
import { useAddChatMember, useChatMembers, useLeaveChat, useRemoveChatMember } from "./members";

const owner: ChatMember = { email: "owner@example.test", role: "owner", addedAt: "2026-01-01T00:00:00.000Z" };
const guest: ChatMember = { email: "guest@example.test", role: "member", addedAt: "2026-01-02T00:00:00.000Z" };
const chat = (id: string): Chat => ({
  id,
  title: id,
  ownerId: "u1",
  provider: "anthropic",
  model: "claude-haiku-4-5",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});
const calls = (requests: Request[]) => requests.map((r) => `${r.method} ${new URL(r.url).pathname}`);

describe("useChatMembers", () => {
  it("lists the members of the chat, owner first", async () => {
    server.use(http.get("*/chats/:chatId/members", () => HttpResponse.json({ members: [owner, guest] })));

    const { result } = renderHookWithClient(() => useChatMembers("chat-1"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([owner, guest]);
  });

  it("does not fetch while disabled", async () => {
    const requests = recordRequests();

    const { result } = renderHookWithClient(() => useChatMembers("chat-1", false));

    expect(result.current.fetchStatus).toBe("idle");
    expect(requests).toHaveLength(0);
  });

  it("exposes the server's refusal as an error", async () => {
    server.use(http.get("*/chats/:chatId/members", () => HttpResponse.json({ error: { code: "FORBIDDEN", message: "Not a member" } }, { status: 403 })));

    const { result } = renderHookWithClient(() => useChatMembers("chat-1"));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 403, message: "Not a member" });
  });
});

describe("useAddChatMember", () => {
  it("posts the email and appends the new member to the cached list", async () => {
    let body: unknown;
    server.use(
      http.post("*/chats/:chatId/members", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ member: guest }, { status: 201 });
      })
    );
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.members("chat-1"), [owner]);
    const { result } = renderHookWithClient(() => useAddChatMember("chat-1"), { queryClient });

    result.current.mutate("guest@example.test");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(body).toEqual({ email: "guest@example.test" });
    expect(queryClient.getQueryData(queryKeys.members("chat-1"))).toEqual([owner, guest]);
  });

  it("does not invent a cached list when the members were never loaded", async () => {
    server.use(http.post("*/chats/:chatId/members", () => HttpResponse.json({ member: guest }, { status: 201 })));
    const queryClient = createTestQueryClient();
    const { result } = renderHookWithClient(() => useAddChatMember("chat-1"), { queryClient });

    result.current.mutate("guest@example.test");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryData(queryKeys.members("chat-1"))).toBeUndefined();
  });

  it("keeps the cached list and surfaces the error when the server refuses", async () => {
    server.use(
      http.post("*/chats/:chatId/members", () =>
        HttpResponse.json(
          { error: { code: "ALREADY_A_MEMBER", message: "That user is already a member of this chat" } },
          { status: 409 }
        )
      )
    );
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.members("chat-1"), [owner]);
    const { result } = renderHookWithClient(() => useAddChatMember("chat-1"), { queryClient });

    result.current.mutate("bob@example.test");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 409, code: "ALREADY_A_MEMBER" });
    expect(queryClient.getQueryData(queryKeys.members("chat-1"))).toEqual([owner]);
  });
});

describe("useRemoveChatMember", () => {
  it("deletes the URL-encoded email and drops that member from the cached list", async () => {
    const requests = recordRequests();
    const plus: ChatMember = { ...guest, email: "a+b@example.test" };
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.members("chat-1"), [owner, plus]);
    const { result } = renderHookWithClient(() => useRemoveChatMember("chat-1"), { queryClient });

    result.current.mutate("a+b@example.test");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(requests[0]!.url).toContain("/chats/chat-1/members/a%2Bb%40example.test");
    expect(queryClient.getQueryData(queryKeys.members("chat-1"))).toEqual([owner]);
  });

  it("keeps the member when the server refuses", async () => {
    server.use(
      http.delete("*/chats/:chatId/members/:email", () => HttpResponse.json({ error: { code: "FORBIDDEN", message: "Owner only" } }, { status: 403 }))
    );
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.members("chat-1"), [owner, guest]);
    const { result } = renderHookWithClient(() => useRemoveChatMember("chat-1"), { queryClient });

    result.current.mutate("guest@example.test");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData(queryKeys.members("chat-1"))).toEqual([owner, guest]);
  });
});

describe("useLeaveChat", () => {
  it("leaves the chat, removes it from the list and forgets everything cached about it", async () => {
    const requests = recordRequests();
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.chats(), [chat("chat-1"), chat("chat-2")]);
    queryClient.setQueryData(queryKeys.chat("chat-1"), chat("chat-1"));
    queryClient.setQueryData(queryKeys.messages("chat-1"), []);
    queryClient.setQueryData(queryKeys.members("chat-1"), [owner]);
    queryClient.setQueryData(queryKeys.messages("chat-2"), []);
    const { result } = renderHookWithClient(() => useLeaveChat("chat-1"), { queryClient });

    result.current.mutate();

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls(requests)).toEqual(["DELETE /api/chats/chat-1/membership"]);
    expect(queryClient.getQueryData<Chat[]>(queryKeys.chats())?.map((c) => c.id)).toEqual(["chat-2"]);
    expect(queryClient.getQueryData(queryKeys.chat("chat-1"))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.messages("chat-1"))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.members("chat-1"))).toBeUndefined();
    expect(queryClient.getQueryData(queryKeys.messages("chat-2"))).toEqual([]);
  });

  it("keeps the chat in the list when leaving fails", async () => {
    server.use(http.delete("*/chats/:chatId/membership", () => HttpResponse.json({ error: { code: "CONFLICT", message: "Owners cannot leave" } }, { status: 409 })));
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(queryKeys.chats(), [chat("chat-1")]);
    const { result } = renderHookWithClient(() => useLeaveChat("chat-1"), { queryClient });

    result.current.mutate();

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData<Chat[]>(queryKeys.chats())).toHaveLength(1);
  });
});
