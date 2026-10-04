#!/usr/bin/env node
// Records provider streams as replay fixtures (AICHAT-25). MANUAL ONLY, never run in CI.
//
//   node scripts/record-llm-fixtures.ts [anthropic|openai ...]
//
// Default target is a local Ollama (OpenAI- and Anthropic-compatible endpoints). The same
// script records from the real APIs when the env vars below point at them:
//
//   OPENAI_BASE_URL     default http://localhost:11434    (real API: https://api.openai.com)
//   OPENAI_MODEL        default llama3.2:1b
//   OPENAI_API_KEY      default "ollama"
//   ANTHROPIC_BASE_URL  default http://localhost:11434    (real API: https://api.anthropic.com)
//   ANTHROPIC_MODEL     default llama3.2:1b
//   ANTHROPIC_API_KEY   default "ollama"
//   FIXTURES_DIR        default services/conversation-service/src/test-utils/fixtures/llm
//
// The response bytes are stored as received, except that ids, request ids, timestamps and
// any copy of the API key are replaced by stable placeholders (see `scrub`). Review the
// git diff before committing a new recording.

import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = process.env.FIXTURES_DIR ?? join(root, "services/conversation-service/src/test-utils/fixtures/llm");
const env = (name: string, fallback: string): string => process.env[name] || fallback;

const PROMPTS = {
  text: "Reply with one short sentence that greets the user in Portuguese, using accents.",
  maxTokens: "Count from 1 to 50, separated by spaces.",
};

interface Provider {
  url: () => string;
  key: () => string;
  headers: (key: string) => Record<string, string>;
  body: (prompt: string, maxTokens: number) => Record<string, unknown>;
}

type ProviderName = "anthropic" | "openai";

interface Scenario {
  provider: ProviderName;
  file: string;
  prompt: string;
  maxTokens: number;
}

const providers: Record<ProviderName, Provider> = {
  anthropic: {
    url: () => `${env("ANTHROPIC_BASE_URL", "http://localhost:11434")}/v1/messages`,
    // Ollama ignores the key; "ollama" is a placeholder, not a secret (AICHAT-27 WAIVERS.md, W10).
    // nosemgrep: node_api_key
    key: () => env("ANTHROPIC_API_KEY", "ollama"),
    headers: (key) => ({ "x-api-key": key, "anthropic-version": "2023-06-01" }),
    body: (prompt, maxTokens) => ({
      model: env("ANTHROPIC_MODEL", "llama3.2:1b"),
      stream: true,
      max_tokens: maxTokens,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
  },
  openai: {
    url: () => `${env("OPENAI_BASE_URL", "http://localhost:11434")}/v1/chat/completions`,
    // Ollama ignores the key; "ollama" is a placeholder, not a secret (AICHAT-27 WAIVERS.md, W10).
    // nosemgrep: node_api_key
    key: () => env("OPENAI_API_KEY", "ollama"),
    headers: (key) => ({ Authorization: `Bearer ${key}` }),
    body: (prompt, maxTokens) => ({
      model: env("OPENAI_MODEL", "llama3.2:1b"),
      stream: true,
      max_tokens: maxTokens,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    }),
  },
};

// Scenarios a local model can produce. Others (thinking, pause_turn, provider errors) are
// written by hand, see fixtures/llm/README.md.
const SCENARIOS: Scenario[] = [
  { provider: "anthropic", file: "text.sse", prompt: PROMPTS.text, maxTokens: 200 },
  { provider: "anthropic", file: "max-tokens.sse", prompt: PROMPTS.maxTokens, maxTokens: 10 },
  { provider: "openai", file: "text.sse", prompt: PROMPTS.text, maxTokens: 200 },
  { provider: "openai", file: "max-tokens.sse", prompt: PROMPTS.maxTokens, maxTokens: 10 },
];

/** Replaces everything that changes between runs with a fixed placeholder. */
export function scrub(text: string, apiKey?: string): string {
  let out = text
    .replace(/msg_[A-Za-z0-9]+/g, "msg_REDACTED")
    .replace(/chatcmpl-[A-Za-z0-9-]+/g, "chatcmpl-REDACTED")
    .replace(/"(id|request_id)":"[^"]*"/g, '"$1":"REDACTED"')
    .replace(/"created(_at)?":\d+/g, '"created$1":0')
    .replace(/"system_fingerprint":"[^"]*"/g, '"system_fingerprint":"fp_REDACTED"')
    // Input and cache counts depend on the server's prompt cache, so they change between runs.
    .replace(/"(input_tokens|cache_read_input_tokens)":\d+/g, '"$1":0')
    .replace(/"service_tier":"[^"]*"/g, '"service_tier":"REDACTED"');
  if (apiKey && apiKey.length > 6) out = out.split(apiKey).join("REDACTED_KEY");
  return out;
}

async function record({ provider, file, prompt, maxTokens }: Scenario): Promise<void> {
  const p = providers[provider];
  const key = p.key();
  const response = await fetch(p.url(), {
    method: "POST",
    headers: { "content-type": "application/json", ...p.headers(key) },
    body: JSON.stringify(p.body(prompt, maxTokens)),
  });
  if (!response.ok) throw new Error(`${provider}/${file}: HTTP ${response.status} ${await response.text()}`);
  const bytes = scrub(Buffer.from(await response.arrayBuffer()).toString("utf8"), key);
  const dir = join(outDir, provider);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), bytes);
  console.log(`recorded ${provider}/${file} (${Buffer.byteLength(bytes)} bytes) from ${p.url()}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const wanted = process.argv.slice(2);
  for (const scenario of SCENARIOS) {
    if (wanted.length === 0 || wanted.includes(scenario.provider)) await record(scenario);
  }
}
