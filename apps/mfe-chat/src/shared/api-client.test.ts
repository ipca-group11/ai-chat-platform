import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { ApiError, apiClient, readLlmApiKey } from "./api-client";
import { CORRELATION_HEADER, LLM_API_KEY_HEADER } from "./types";

/** Captures the last request a handler saw, with its body already read. */
function capture() {
  const seen: { url: URL; method: string; headers: Headers; body: string; credentials: RequestCredentials }[] = [];
  return {
    seen,
    handler: async ({ request }: { request: Request }) => {
      seen.push({
        url: new URL(request.url),
        method: request.method,
        headers: request.headers,
        body: await request.text(),
        credentials: request.credentials,
      });
      return HttpResponse.json({ ok: { value: 1 } });
    },
  };
}

describe("apiClient requests", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it("uses the /api base, sends cookies and a fresh correlation id on every call", async () => {
    const { seen, handler } = capture();
    server.use(http.get("*/ping", handler));

    await apiClient.get("/ping");
    await apiClient.get("/ping");

    expect(apiClient.baseUrl).toBe("/api");
    expect(seen.map((r) => r.url.pathname)).toEqual(["/api/ping", "/api/ping"]);
    expect(seen[0]!.credentials).toBe("include");
    const [first, second] = seen.map((r) => r.headers.get(CORRELATION_HEADER));
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(second).not.toBe(first);
  });

  it("sends JSON bodies with a JSON content type for post and patch", async () => {
    const post = capture();
    const patch = capture();
    server.use(http.post("*/things", post.handler), http.patch("*/things/1", patch.handler));

    await apiClient.post("/things", { name: "a" });
    await apiClient.patch("/things/1", { name: "b" });

    expect(post.seen[0]).toMatchObject({ method: "POST", body: '{"name":"a"}' });
    expect(post.seen[0]!.headers.get("content-type")).toBe("application/json");
    expect(patch.seen[0]).toMatchObject({ method: "PATCH", body: '{"name":"b"}' });
  });

  it("sends no body and no content type when there is none", async () => {
    const { seen, handler } = capture();
    server.use(http.post("*/empty", handler), http.delete("*/things/1", handler));

    await apiClient.post("/empty");
    await apiClient.delete("/things/1");

    expect(seen.map((r) => [r.method, r.body, r.headers.get("content-type")])).toEqual([
      ["POST", "", null],
      ["DELETE", "", null],
    ]);
  });

  it("leaves a FormData body to the browser instead of forcing a JSON content type", async () => {
    const { seen, handler } = capture();
    server.use(http.post("*/upload", handler));
    const form = new FormData();
    form.append("field", "value");

    await apiClient.post("/upload", form);

    expect(seen[0]!.headers.get("content-type")).not.toBe("application/json");
  });

  it("passes caller headers through", async () => {
    const { seen, handler } = capture();
    server.use(http.get("*/ping", handler));

    await apiClient.get("/ping", { headers: { "X-Custom": "yes" } });

    expect(seen[0]!.headers.get("X-Custom")).toBe("yes");
  });
});

describe("apiClient LLM key header", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it("attaches the session key of the provider when asked to", async () => {
    sessionStorage.setItem("llm-api-key-session:user-1:anthropic", "sk-test-1234");
    const { seen, handler } = capture();
    server.use(http.post("*/chats/c1/messages", handler));

    await apiClient.post("/chats/c1/messages", { content: "hi" }, { llmKey: { userId: "user-1", provider: "anthropic" } });

    expect(seen[0]!.headers.get(LLM_API_KEY_HEADER)).toBe("sk-test-1234");
  });

  it("sends no key header when none is stored for that user and provider", async () => {
    sessionStorage.setItem("llm-api-key-session:user-1:openai", "sk-other");
    const { seen, handler } = capture();
    server.use(http.post("*/chats/c1/messages", handler));

    await apiClient.post("/chats/c1/messages", {}, { llmKey: { userId: "user-1", provider: "anthropic" } });

    expect(seen[0]!.headers.has(LLM_API_KEY_HEADER)).toBe(false);
  });

  it("never sends the key unless the call opts in", async () => {
    sessionStorage.setItem("llm-api-key-session:user-1:anthropic", "sk-test-1234");
    const { seen, handler } = capture();
    server.use(http.get("*/ping", handler));

    await apiClient.get("/ping");

    expect(seen[0]!.headers.has(LLM_API_KEY_HEADER)).toBe(false);
  });

  it("reads the key from sessionStorage and returns null when it is missing", () => {
    sessionStorage.setItem("llm-api-key-session:u:openai", "sk-abc");

    expect(readLlmApiKey("u", "openai")).toBe("sk-abc");
    expect(readLlmApiKey("u", "anthropic")).toBeNull();
  });
});

describe("apiClient responses", () => {
  it("unwraps the single-key envelope of conversation-service", async () => {
    server.use(http.get("*/chats", () => HttpResponse.json({ chats: [{ id: "c1" }] })));

    await expect(apiClient.get("/chats")).resolves.toEqual([{ id: "c1" }]);
  });

  it("keeps bodies that are not a single-key envelope of an object", async () => {
    server.use(
      http.get("*/multi", () => HttpResponse.json({ a: { x: 1 }, b: { y: 2 } })),
      http.get("*/scalar", () => HttpResponse.json({ stopped: true })),
      http.get("*/list", () => HttpResponse.json([{ id: 1 }])),
      http.get("*/null", () => HttpResponse.json(null))
    );

    await expect(apiClient.get("/multi")).resolves.toEqual({ a: { x: 1 }, b: { y: 2 } });
    await expect(apiClient.get("/scalar")).resolves.toEqual({ stopped: true });
    await expect(apiClient.get("/list")).resolves.toEqual([{ id: 1 }]);
    await expect(apiClient.get("/null")).resolves.toBeNull();
  });

  it("resolves to undefined on 204 without reading a body", async () => {
    server.use(http.delete("*/things/1", () => new HttpResponse(null, { status: 204 })));

    await expect(apiClient.delete("/things/1")).resolves.toBeUndefined();
  });
});

describe("apiClient errors", () => {
  it("throws an ApiError with the status, message and code from the JSON body", async () => {
    server.use(http.get("*/chats/x", () => HttpResponse.json({ message: "Chat not found", code: "chat_not_found" }, { status: 404 })));

    const error = await apiClient.get("/chats/x").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ name: "ApiError", status: 404, message: "Chat not found", code: "chat_not_found" });
  });

  it("falls back to the status text when the error body has no message", async () => {
    server.use(http.get("*/boom", () => HttpResponse.json({ detail: "x" }, { status: 409, statusText: "Conflict" })));

    await expect(apiClient.get("/boom")).rejects.toMatchObject({ status: 409, message: "Conflict", code: undefined });
  });

  it("falls back to the status text when the error body is not JSON", async () => {
    server.use(
      http.get("*/html", () => new HttpResponse("<h1>Bad gateway</h1>", { status: 502, statusText: "Bad Gateway" }))
    );

    await expect(apiClient.get("/html")).rejects.toMatchObject({ status: 502, message: "Bad Gateway" });
  });

  it("lets a network failure reject the call as it is", async () => {
    server.use(http.get("*/down", () => HttpResponse.error()));

    await expect(apiClient.get("/down")).rejects.toBeInstanceOf(TypeError);
  });

  it("does not retry a failed request", async () => {
    const requests = recordRequests();
    server.use(http.get("*/flaky", () => HttpResponse.json({ message: "Try later" }, { status: 503 })));

    await expect(apiClient.get("/flaky")).rejects.toMatchObject({ status: 503 });

    expect(requests).toHaveLength(1);
  });
});
