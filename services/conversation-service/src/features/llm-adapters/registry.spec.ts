import { afterEach, describe, expect, it, vi } from "vitest";
import { mockStreamResponse } from "../../test-utils/mock-stream.js";
import { createProviderRegistry } from "./registry.js";

describe("createProviderRegistry", () => {
  it("AC-64: selects the adapter implementation based on the configured provider", () => {
    const registry = createProviderRegistry({ ollamaBaseUrl: "http://localhost:11434" });
    expect(registry.get("ollama").id).toBe("ollama");
    expect(registry.get("openai").id).toBe("openai");
    expect(registry.get("anthropic").id).toBe("anthropic");
  });

  it("throws a clear error for an unregistered provider id", () => {
    const registry = createProviderRegistry({ ollamaBaseUrl: "http://localhost:11434" });
    expect(() => registry.get("unknown" as never)).toThrow(/No LLM provider adapter registered/);
  });

  it("AC-65: every registered adapter implements the same LlmProvider surface", () => {
    const registry = createProviderRegistry({ ollamaBaseUrl: "http://localhost:11434" });
    for (const id of ["ollama", "openai", "anthropic"] as const) {
      const adapter = registry.get(id);
      expect(typeof adapter.sendMessage).toBe("function");
      expect(typeof adapter.supportsVision).toBe("function");
    }
  });
});

describe("createProviderRegistry base URLs (AICHAT-43)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Sends one message through the registry and returns the URL the adapter called. */
  async function calledUrl(provider: "openai" | "anthropic", env: NodeJS.ProcessEnv): Promise<string> {
    const fetchMock = vi.fn().mockResolvedValue(mockStreamResponse(["data: [DONE]\n\n"]));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createProviderRegistry(env).get(provider);
    for await (const _token of adapter.sendMessage({ messages: [], model: "m", apiKey: "k" })) {
      // drain
    }
    return String(fetchMock.mock.calls[0]?.[0]);
  }

  it("keeps the real API hosts when the variables are not set", async () => {
    expect(await calledUrl("anthropic", {})).toBe("https://api.anthropic.com/v1/messages");
    expect(await calledUrl("openai", {})).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("reads ANTHROPIC_BASE_URL", async () => {
    const env = { ANTHROPIC_BASE_URL: "http://localhost:4010/anthropic" };
    expect(await calledUrl("anthropic", env)).toBe("http://localhost:4010/anthropic/v1/messages");
  });

  it("reads OPENAI_BASE_URL", async () => {
    const env = { OPENAI_BASE_URL: "http://localhost:4010/openai" };
    expect(await calledUrl("openai", env)).toBe("http://localhost:4010/openai/v1/chat/completions");
  });

  it("rejects a base URL that is not a URL", () => {
    expect(() => createProviderRegistry({ OPENAI_BASE_URL: "nope" })).toThrow();
  });
});

describe("createProviderRegistry web fetch domains (AICHAT-242)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gives the Anthropic adapter the domain list of the deployment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockStreamResponse([`data: ${JSON.stringify({ type: "message_stop" })}\n\n`]));
    vi.stubGlobal("fetch", fetchMock);
    const adapter = createProviderRegistry({ WEB_FETCH_ALLOWED_DOMAINS: "Example.com, docs.python.org" }).get("anthropic");
    for await (const _chunk of adapter.sendMessage({ messages: [{ role: "user", content: "hi" }], model: "claude-opus-5-5", apiKey: "k", webFetch: true })) {
      // drain
    }
    const body = JSON.parse((fetchMock.mock.calls[0]?.[1] as RequestInit).body as string) as { tools: Array<Record<string, unknown>> };
    expect(body.tools[0]?.allowed_domains).toEqual(["example.com", "docs.python.org"]);
  });
});
