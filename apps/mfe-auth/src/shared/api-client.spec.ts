import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch, ApiError } from "./api-client";
import { CORRELATION_HEADER } from "./correlation";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("apiFetch", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("always sends credentials: include so httpOnly cookies are attached", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch("/auth/me");

    expect(fetch).toHaveBeenCalledWith(
      "/auth/me",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("injects a correlation id header when the caller didn't set one", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch("/auth/me");

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get(CORRELATION_HEADER)).toBeTruthy();
  });

  it("preserves a caller-supplied correlation id instead of overwriting it", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ ok: true }));

    await apiFetch("/auth/me", { headers: { [CORRELATION_HEADER]: "given-id" } });

    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get(CORRELATION_HEADER)).toBe("given-id");
  });

  it("throws an ApiError with the server's message on a non-2xx response", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "Invalid email or password" }, 401));

    await expect(apiFetch("/auth/login", { method: "POST", body: {} })).rejects.toMatchObject({
      status: 401,
      message: "Invalid email or password",
    });
    await expect(apiFetch("/auth/login", { method: "POST", body: {} })).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  it("resolves with parsed JSON on success", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ id: "1", email: "a@b.com" }, 200));

    await expect(apiFetch("/auth/me")).resolves.toEqual({ id: "1", email: "a@b.com" });
  });
});
