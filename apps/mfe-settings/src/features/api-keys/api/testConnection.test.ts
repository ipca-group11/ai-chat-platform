import { LLM_API_KEY_HEADER } from "@app/shared-types/api-keys";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { testConnection } from "./testConnection";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("testConnection", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-85: sends the API key once in the X-Llm-Api-Key header, not in the body", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: true }));

    await testConnection("openai", "sk-my-secret-key");

    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(String(url)).toContain("/providers/openai/test-connection");
    const headers = new Headers(init?.headers);
    expect(headers.get(LLM_API_KEY_HEADER)).toBe("sk-my-secret-key");
    expect(String(init?.body)).not.toContain("sk-my-secret-key");
  });

  it("AC-85: resolves { success: true } on a successful response", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: true }));

    await expect(testConnection("openai", "sk-key")).resolves.toEqual({ success: true });
  });

  it("AC-85: resolves a clear failure reason for an invalid key (non-2xx response)", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: "Invalid API key" }, 401));

    await expect(testConnection("anthropic", "bad-key")).resolves.toEqual({
      success: false,
      message: "Invalid API key",
    });
  });

  it("AC-85: resolves a clear failure reason on a network error, without throwing", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await testConnection("openai", "sk-key");

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/network error/i);
  });

  it("AC-85: falls back to an 'error' field when the response has no 'message'", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ error: "Rate limited" }, 429));

    await expect(testConnection("openai", "sk-key")).resolves.toEqual({
      success: false,
      message: "Rate limited",
    });
  });

  it("AC-85: falls back to the response status text when the error body isn't JSON", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("not json", { status: 500, statusText: "Internal Server Error" }),
    );

    await expect(testConnection("openai", "sk-key")).resolves.toEqual({
      success: false,
      message: "Internal Server Error",
    });
  });

  it("AC-85: resolves a clear failure reason when a 2xx response body doesn't match the contract", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ notSuccess: true }));

    const result = await testConnection("openai", "sk-key");

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/unexpected response/i);
  });
});
