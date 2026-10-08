import type { APIRequestContext } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";
import { llmRequestFor, type LlmRequest } from "./llm-mock.js";

const entry = (id: number, content: unknown, extra: Partial<LlmRequest> = {}): LlmRequest => ({
  id,
  path: "/anthropic/v1/messages",
  body: { messages: [{ role: "user", content }] },
  finishedAt: null,
  clientClosedAt: null,
  ...extra,
});

function fakeRequest(requests: LlmRequest[]) {
  const get = vi.fn(async (url: string) => ({ url, ok: () => true, json: async () => ({ requests }) }));
  return { request: { get } as unknown as APIRequestContext, get };
}

describe("llmRequestFor (AICHAT-201)", () => {
  it("asks the mock's admin API for the requests of the given provider", async () => {
    const { request, get } = fakeRequest([]);
    await llmRequestFor(request, "x", "openai");
    expect(get.mock.calls[0]?.[0]).toMatch(/\/__admin\/requests\?mock=openai$/);
  });

  it("finds the request by the text of its last user message, as a string or as content blocks", async () => {
    const { request } = fakeRequest([entry(1, "other prompt"), entry(2, [{ type: "text", text: "Stop me 42" }])]);
    expect((await llmRequestFor(request, "Stop me 42"))?.id).toBe(2);
    expect((await llmRequestFor(request, "other prompt"))?.id).toBe(1);
  });

  it("returns the latest matching request and undefined when none matches", async () => {
    const { request } = fakeRequest([entry(1, "same"), entry(2, "same", { clientClosedAt: "t" })]);
    expect((await llmRequestFor(request, "same"))?.clientClosedAt).toBe("t");
    expect(await llmRequestFor(request, "missing")).toBeUndefined();
  });
});
