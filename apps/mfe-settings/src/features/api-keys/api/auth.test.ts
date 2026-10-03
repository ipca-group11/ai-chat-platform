import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError, fetchCurrentUser } from "./auth";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchCurrentUser", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-78: calls GET /auth/me with credentials included so the session cookie is sent", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: "user-1", email: "a@b.com" }));

    await fetchCurrentUser();

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/auth/me"),
      expect.objectContaining({ method: "GET", credentials: "include" }),
    );
  });

  it("AC-78: resolves with the current user id and email", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: "user-1", email: "a@b.com" }));

    const user = await fetchCurrentUser();

    expect(user).toEqual({ id: "user-1", email: "a@b.com" });
  });

  it("throws an AuthError with the response status when unauthenticated", async () => {
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 401, statusText: "Unauthorized" }));

    await expect(fetchCurrentUser()).rejects.toThrow(AuthError);
    await expect(fetchCurrentUser()).rejects.toMatchObject({ status: 401 });
  });
});
