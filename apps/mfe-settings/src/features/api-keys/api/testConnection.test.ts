import { LLM_API_KEY_HEADER } from "@app/shared-types/api-keys";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { describe, expect, it } from "vitest";
import { testConnection } from "./testConnection";

const respondWith = (response: () => Response) =>
  server.use(http.post("*/providers/:provider/test-connection", response));

describe("testConnection", () => {
  it("AC-85: sends the API key once in the X-Llm-Api-Key header, not in the body", async () => {
    const requests = recordRequests();

    await testConnection("openai", "sk-my-secret-key");

    expect(new URL(requests[0]!.url).pathname).toBe("/providers/openai/test-connection");
    expect(requests[0]!.headers.get(LLM_API_KEY_HEADER)).toBe("sk-my-secret-key");
    expect(await requests[0]!.text()).not.toContain("sk-my-secret-key");
  });

  it("AC-85: resolves { success: true } on a successful response", async () => {
    await expect(testConnection("openai", "sk-key")).resolves.toEqual({ success: true });
  });

  it("AC-85: resolves a clear failure reason for an invalid key (non-2xx response)", async () => {
    respondWith(() => HttpResponse.json({ message: "Invalid API key" }, { status: 401 }));

    await expect(testConnection("anthropic", "bad-key")).resolves.toEqual({
      success: false,
      message: "Invalid API key",
    });
  });

  it("AC-85: resolves a clear failure reason on a network error, without throwing", async () => {
    respondWith(() => HttpResponse.error());

    const result = await testConnection("openai", "sk-key");

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/network error/i);
  });

  it("AC-85: falls back to an 'error' field when the response has no 'message'", async () => {
    respondWith(() => HttpResponse.json({ error: "Rate limited" }, { status: 429 }));

    await expect(testConnection("openai", "sk-key")).resolves.toEqual({
      success: false,
      message: "Rate limited",
    });
  });

  it("AC-85: falls back to the response status text when the error body isn't JSON", async () => {
    respondWith(() => new HttpResponse("not json", { status: 500, statusText: "Internal Server Error" }));

    await expect(testConnection("openai", "sk-key")).resolves.toEqual({
      success: false,
      message: "Internal Server Error",
    });
  });

  it("AC-85: resolves a clear failure reason when a 2xx response body doesn't match the contract", async () => {
    respondWith(() => HttpResponse.json({ notSuccess: true }));

    const result = await testConnection("openai", "sk-key");

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/unexpected response/i);
  });
});
