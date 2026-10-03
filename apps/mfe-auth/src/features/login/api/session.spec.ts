import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/api-client";
import { fetchSessionWithRefresh } from "./session";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchSessionWithRefresh (F4 session contract)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-41: resolves with the current user when /auth/me succeeds", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: "1", email: "a@b.com" }, 200));

    await expect(fetchSessionWithRefresh()).resolves.toEqual({ id: "1", email: "a@b.com" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("AC-41: a 401 from /auth/me triggers one silent refresh, then retries /auth/me once", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401)) // GET /auth/me
      .mockResolvedValueOnce(jsonResponse(undefined, 204)) // POST /auth/refresh
      .mockResolvedValueOnce(jsonResponse({ id: "1", email: "a@b.com" }, 200)); // GET /auth/me retry

    await expect(fetchSessionWithRefresh()).resolves.toEqual({ id: "1", email: "a@b.com" });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(vi.mocked(fetch).mock.calls[1]![0]).toBe("/auth/refresh");
  });

  it("AC-41: surfaces 'not authenticated' (a 401 ApiError) if the refresh retry also fails, without retrying again", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401)) // GET /auth/me
      .mockResolvedValueOnce(jsonResponse(undefined, 204)) // POST /auth/refresh succeeds
      .mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401)); // GET /auth/me retry fails

    const failure = fetchSessionWithRefresh();
    await expect(failure).rejects.toMatchObject({ status: 401 });
    await expect(failure).rejects.toBeInstanceOf(ApiError);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("AC-41: a non-401 error from /auth/me is rethrown immediately without attempting a refresh", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "Server error" }, 500));

    await expect(fetchSessionWithRefresh()).rejects.toMatchObject({ status: 500 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
