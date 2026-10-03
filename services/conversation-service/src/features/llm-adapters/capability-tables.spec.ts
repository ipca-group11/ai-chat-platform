import { describe, expect, it, vi } from "vitest";
import { mockStreamResponse } from "../../test-utils/mock-stream.js";
import { AnthropicProvider } from "./anthropic.provider.js";
import { OpenAiProvider } from "./openai.provider.js";

// The tables are module-private, so they are checked through the public capability
// methods and the request each model produces. First match wins in both tables, so the
// cases around the overlapping prefixes (opus-5-5 vs opus-5, opus-4-6 vs opus-4) matter.

const anthropic = new AnthropicProvider();

describe("VISION_MODEL_HINTS (anthropic)", () => {
  it.each([
    ["claude-3-5-sonnet-latest", true],
    ["claude-opus-5-5", true],
    ["claude-sonnet-4-6", true],
    ["claude-haiku-4-5", true],
    ["CLAUDE-SONNET-5", true],
    ["claude-2.1", false],
    ["claude-instant-1", false],
    ["gpt-5", false],
    ["", false],
  ])("%s -> %s", (model, expected) => {
    expect(anthropic.supportsVision(model)).toBe(expected);
  });
});

describe("VISION_MODEL_HINTS (openai)", () => {
  const openai = new OpenAiProvider();
  it.each([
    ["gpt-4o", true],
    ["gpt-4o-mini", true],
    ["gpt-4-vision-preview", true],
    ["gpt-4.1", true],
    ["gpt-5", true],
    ["o4-mini", true],
    ["GPT-5-NANO", true],
    ["gpt-3.5-turbo", false],
    ["gpt-4", false],
    ["o1", false],
  ])("%s -> %s", (model, expected) => {
    expect(openai.supportsVision(model)).toBe(expected);
  });
});

describe("WEB_FETCH_TOOLS", () => {
  it.each([
    ["claude-fable", "web_fetch_20260318"],
    ["claude-mythos-1", "web_fetch_20260318"],
    ["claude-opus-5-5", "web_fetch_20260318"],
    ["claude-sonnet-5-5", "web_fetch_20260318"],
    ["claude-opus-4-8", "web_fetch_20260318"],
    ["claude-opus-4-7", "web_fetch_20260318"],
    ["claude-opus-4-6", "web_fetch_20260318"],
    ["claude-sonnet-4-6", "web_fetch_20260318"],
    ["claude-opus-4-5", "web_fetch_20250910"],
    ["claude-sonnet-4-5", "web_fetch_20250910"],
    ["claude-haiku-4-5", "web_fetch_20250910"],
    ["claude-3-7-sonnet-latest", "web_fetch_20250910"],
    ["claude-3-5-sonnet-latest", undefined],
    ["claude-2.1", undefined],
  ])("%s -> %s", async (model, tool) => {
    expect(anthropic.supportsWebFetch(model)).toBe(tool !== undefined);

    const fetchImpl = vi.fn().mockResolvedValue(mockStreamResponse([`data: ${JSON.stringify({ type: "message_stop" })}\n\n`]));
    const provider = new AnthropicProvider({ fetchImpl });
    for await (const _ of provider.sendMessage({ messages: [{ role: "user", content: "hi" }], model, apiKey: "k", webFetch: true })) {
      // drain
    }
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string) as { tools?: Array<{ type: string; name: string }> };
    expect(body.tools?.[0]?.type).toBe(tool);
  });

  it("never offers web fetch on OpenAI", () => {
    expect(new OpenAiProvider().supportsWebFetch()).toBe(false);
  });
});

describe("THINKING_STYLES", () => {
  async function body(model: string, reasoning: boolean) {
    const fetchImpl = vi.fn().mockResolvedValue(mockStreamResponse([`data: ${JSON.stringify({ type: "message_stop" })}\n\n`]));
    const provider = new AnthropicProvider({ fetchImpl });
    for await (const _ of provider.sendMessage({ messages: [{ role: "user", content: "hi" }], model, apiKey: "k", reasoning })) {
      // drain
    }
    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    return JSON.parse(init.body as string) as Record<string, any>;
  }

  type Style = "always-on" | "between-tools" | "adaptive" | "budget" | "none";
  const cases: Array<[string, Style]> = [
    ["claude-fable-1", "always-on"],
    ["claude-mythos-1", "always-on"],
    ["claude-opus-5-5", "always-on"],
    ["claude-sonnet-5-5", "between-tools"],
    ["claude-opus-5", "adaptive"],
    ["claude-sonnet-5", "adaptive"],
    ["claude-opus-4-8", "adaptive"],
    ["claude-opus-4-7", "adaptive"],
    ["claude-opus-4-6", "adaptive"],
    ["claude-sonnet-4-6", "adaptive"],
    ["claude-opus-4-5", "budget"],
    ["claude-sonnet-4-5", "budget"],
    ["claude-haiku-4-5", "budget"],
    ["claude-3-7-sonnet-latest", "budget"],
    ["claude-3-5-sonnet-latest", "none"],
    ["claude-2.1", "none"],
  ];

  it.each(cases)("%s is %s", async (model, style) => {
    expect(anthropic.supportsReasoning(model)).toBe(style !== "none");

    const on = await body(model, true);
    const off = await body(model, false);

    switch (style) {
      case "always-on":
        expect(on.thinking?.type).toBe("adaptive");
        expect(on.output_config).toEqual({ effort: "high" });
        expect(off.thinking).toBeUndefined();
        expect(off.output_config).toEqual({ effort: "low" });
        break;
      case "between-tools":
        expect(on.thinking?.type).toBe("adaptive");
        expect(off.thinking).toEqual({ type: "between_tools" });
        break;
      case "adaptive":
        expect(on.thinking?.type).toBe("adaptive");
        expect(off.thinking).toEqual({ type: "disabled" });
        break;
      case "budget":
        expect(on.thinking).toMatchObject({ type: "enabled" });
        expect(on.thinking.budget_tokens).toBeLessThan(on.max_tokens);
        expect(off.thinking).toBeUndefined();
        break;
      case "none":
        expect(on.thinking).toBeUndefined();
        expect(on.output_config).toBeUndefined();
        break;
    }
  });

  it("matches the more specific id first (opus-5-5 is not plain opus-5)", async () => {
    expect((await body("claude-opus-5-5", false)).thinking).toBeUndefined();
    expect((await body("claude-opus-5", false)).thinking).toEqual({ type: "disabled" });
  });

  it("is case-insensitive", () => {
    expect(anthropic.supportsReasoning("CLAUDE-OPUS-5-5")).toBe(true);
  });

  it.each([
    ["o1", true], ["o3-mini", true], ["o4-mini", true], ["gpt-5", true], ["gpt-9-x", true],
    ["gpt-4o", false], ["gpt-4.1", false], ["gpt-3.5-turbo", false],
  ])("openai %s -> %s", (model, expected) => {
    expect(new OpenAiProvider().supportsReasoning(model)).toBe(expected);
  });
});
