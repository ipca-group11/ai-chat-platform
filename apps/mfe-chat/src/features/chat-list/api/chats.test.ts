import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createTestQueryClient, renderHookWithClient } from "@platform/test-utils";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { useChat, useChats, useCreateChat, useDeleteChat, useUpdateChat } from "./chats";
import type { Chat } from "../../../shared/types";

const chatA: Chat = {
  id: "chat-1",
  title: "First chat",
  ownerId: "user-1",
  provider: "ollama",
  model: "llama3.2:1b",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("useChats (AC-42, AC-47)", () => {
  it("AC-42: lists the current user's chats", async () => {
    server.use(http.get("*/chats", () => HttpResponse.json({ chats: [chatA] })));

    const { result } = renderHookWithClient(() => useChats());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([chatA]);
  });

  it("AC-47: never fabricates chats beyond what the server returns (empty list stays empty)", async () => {
    server.use(http.get("*/chats", () => HttpResponse.json({ chats: [] })));

    const { result } = renderHookWithClient(() => useChats());

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe("useChat (AC-43, AC-46)", () => {
  it("AC-43: fetches a single chat so it can be restored after reload/relogin", async () => {
    server.use(http.get("*/chats/:chatId", () => HttpResponse.json({ chat: chatA })));

    const { result } = renderHookWithClient(() => useChat("chat-1"));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(chatA);
  });

  it("AC-46: surfaces a 403 without retrying so the UI can show a clear not-found/error state", async () => {
    server.use(http.get("*/chats/:chatId", () => HttpResponse.json({ error: { code: "FORBIDDEN", message: "Forbidden" } }, { status: 403 })));
    const requests = recordRequests();

    const { result } = renderHookWithClient(() => useChat("chat-owned-by-another-user"));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.status).toBe(403);
    expect(requests).toHaveLength(1);
  });

  it("AC-46: surfaces a 404 without retrying", async () => {
    server.use(http.get("*/chats/:chatId", () => HttpResponse.json({ error: { code: "NOT_FOUND", message: "Not found" } }, { status: 404 })));
    const requests = recordRequests();

    const { result } = renderHookWithClient(() => useChat("missing-chat"));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.status).toBe(404);
    expect(requests).toHaveLength(1);
  });
});

describe("useCreateChat (AC-42, AC-48, AC-49)", () => {
  it("AC-42/AC-48/AC-49: creates a chat with the chosen provider/model and adds it to the cached list", async () => {
    server.use(http.post("*/chats", () => HttpResponse.json({ chat: chatA }, { status: 201 })));
    const requests = recordRequests();

    const { result } = renderHookWithClient(() => useCreateChat());

    result.current.mutate({ title: "First chat", provider: "ollama", model: "llama3.2:1b" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(await requests[0]!.json()).toEqual({
      title: "First chat",
      provider: "ollama",
      model: "llama3.2:1b",
    });
  });
});

describe("useUpdateChat (AC-42, AC-48, AC-49)", () => {
  it("AC-42/AC-48/AC-49: renames a chat and updates both the single-chat and list caches", async () => {
    const renamed: Chat = { ...chatA, title: "Renamed" };
    server.use(http.patch("*/chats/:chatId", () => HttpResponse.json({ chat: renamed })));

    const client = createTestQueryClient();
    client.setQueryData(["chats"], [chatA]);

    const { result } = renderHookWithClient(() => useUpdateChat(), { queryClient: client });
    result.current.mutate({ chatId: chatA.id, title: "Renamed" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(["chats", chatA.id])).toEqual(renamed);
    expect(client.getQueryData<Chat[]>(["chats"])?.[0]?.title).toBe("Renamed");
  });
});

describe("useDeleteChat (AC-44)", () => {
  it("AC-44: removes the deleted chat's cached data so it no longer appears or loads", async () => {
    const client = createTestQueryClient();
    client.setQueryData(["chats"], [chatA]);
    client.setQueryData(["chats", chatA.id], chatA);

    const { result } = renderHookWithClient(() => useDeleteChat(), { queryClient: client });

    result.current.mutate(chatA.id);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(["chats"])).toEqual([]);
    expect(client.getQueryData(["chats", chatA.id])).toBeUndefined();
  });
});
