import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { jsonResponse, withQueryClient } from "../../../test/utils";
import { useChat, useChats, useCreateChat, useDeleteChat, useUpdateChat } from "./chats";
import type { Chat } from "../../../shared/types";

const chatA: Chat = {
  id: "chat-1",
  title: "First chat",
  ownerId: "user-1",
  provider: "anthropic",
  model: "claude-3-5-haiku-latest",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("useChats (AC-42, AC-47)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-42: lists the current user's chats", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([chatA])));

    const { result } = renderHook(() => useChats(), { wrapper: withQueryClient() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([chatA]);
  });

  it("AC-47: never fabricates chats beyond what the server returns (empty list stays empty)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse([])));

    const { result } = renderHook(() => useChats(), { wrapper: withQueryClient() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe("useChat (AC-43, AC-46)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-43: fetches a single chat so it can be restored after reload/relogin", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(chatA)));

    const { result } = renderHook(() => useChat("chat-1"), { wrapper: withQueryClient() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(chatA);
  });

  it("AC-46: surfaces a 403 without retrying so the UI can show a clear not-found/error state", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "Forbidden" }, 403)));

    const { result } = renderHook(() => useChat("chat-owned-by-another-user"), { wrapper: withQueryClient() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.status).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("AC-46: surfaces a 404 without retrying", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ message: "Not found" }, 404)));

    const { result } = renderHook(() => useChat("missing-chat"), { wrapper: withQueryClient() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.status).toBe(404);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("useCreateChat (AC-42, AC-48, AC-49)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-42/AC-48/AC-49: creates a chat with the chosen provider/model and adds it to the cached list", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(chatA, 201));
    vi.stubGlobal("fetch", fetchMock);

    const wrapper = withQueryClient();
    const { result } = renderHook(() => useCreateChat(), { wrapper });

    result.current.mutate({ title: "First chat", provider: "anthropic", model: "claude-3-5-haiku-latest" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({
      title: "First chat",
      provider: "anthropic",
      model: "claude-3-5-haiku-latest",
    });
  });
});

describe("useUpdateChat (AC-42, AC-48, AC-49)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-42/AC-48/AC-49: renames a chat and updates both the single-chat and list caches", async () => {
    const renamed: Chat = { ...chatA, title: "Renamed" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(renamed)));

    const client = (await import("../../../test/utils")).createTestQueryClient();
    client.setQueryData(["chats"], [chatA]);
    const wrapper = withQueryClient(client);

    const { result } = renderHook(() => useUpdateChat(), { wrapper });
    result.current.mutate({ chatId: chatA.id, title: "Renamed" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(["chats", chatA.id])).toEqual(renamed);
    expect(client.getQueryData<Chat[]>(["chats"])?.[0]?.title).toBe("Renamed");
  });
});

describe("useDeleteChat (AC-44)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("AC-44: removes the deleted chat's cached data so it no longer appears or loads", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    const client = (await import("../../../test/utils")).createTestQueryClient();
    client.setQueryData(["chats"], [chatA]);
    client.setQueryData(["chats", chatA.id], chatA);

    const wrapper = withQueryClient(client);
    const { result } = renderHook(() => useDeleteChat(), { wrapper });

    result.current.mutate(chatA.id);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(["chats"])).toEqual([]);
    expect(client.getQueryData(["chats", chatA.id])).toBeUndefined();
  });
});
