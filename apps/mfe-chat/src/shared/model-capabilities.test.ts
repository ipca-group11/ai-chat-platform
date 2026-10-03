import { describe, expect, it } from "vitest";
import { supportsReasoning, supportsWebFetch } from "./model-capabilities";

describe("supportsReasoning", () => {
  it("recognises reasoning models per provider", () => {
    expect(supportsReasoning("ollama", "qwen3:4b")).toBe(true);
    expect(supportsReasoning("ollama", "deepseek-r1:8b")).toBe(true);
    expect(supportsReasoning("openai", "o4-mini")).toBe(true);
    expect(supportsReasoning("openai", "gpt-5-mini")).toBe(true);
    expect(supportsReasoning("anthropic", "claude-opus-5-5")).toBe(true);
    expect(supportsReasoning("anthropic", "claude-haiku-4-5")).toBe(true);
  });

  it("rejects models without reasoning", () => {
    expect(supportsReasoning("ollama", "llama3.2:1b")).toBe(false);
    expect(supportsReasoning("openai", "gpt-4o")).toBe(false);
    expect(supportsReasoning("anthropic", "claude-3-5-sonnet-latest")).toBe(false);
  });
});

describe("supportsWebFetch", () => {
  it("is offered on Claude 3.7+ models only", () => {
    expect(supportsWebFetch("anthropic", "claude-opus-5-5")).toBe(true);
    expect(supportsWebFetch("anthropic", "claude-haiku-4-5")).toBe(true);
    expect(supportsWebFetch("anthropic", "claude-3-5-sonnet-latest")).toBe(false);
    expect(supportsWebFetch("openai", "gpt-5-mini")).toBe(false);
    expect(supportsWebFetch("ollama", "qwen3:4b")).toBe(false);
  });
});
