import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCurrentUserId } from "./useCurrentUserId";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useCurrentUserId", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-78: resolves the current user's id from GET /auth/me", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: "user-42", email: "a@b.com" }));

    const { result } = renderHook(() => useCurrentUserId(), { wrapper });

    await waitFor(() => expect(result.current.userId).toBe("user-42"));
  });

  it("reports isError without a userId when the session lookup fails", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 401 }));

    const { result } = renderHook(() => useCurrentUserId(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.userId).toBeUndefined();
  });
});
