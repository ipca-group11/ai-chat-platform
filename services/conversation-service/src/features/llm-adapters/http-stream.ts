/**
 * Small fetch-response streaming helpers shared by the provider adapters. Kept
 * provider-agnostic (raw lines, or SSE `data:` lines for OpenAI/Anthropic) so each
 * adapter only has to parse its own payload shape.
 */

/** Splits a fetch response body into newline-delimited text chunks. */
export async function* readLines(body: ReadableStream<Uint8Array> | null): AsyncGenerator<string> {
  if (!body) return;
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (line.length > 0) yield line;
      }
    }
    const rest = buffer.trim();
    if (rest.length > 0) yield rest;
  } finally {
    reader.releaseLock();
  }
}

/** Splits an SSE body into `data: ...` payload strings, skipping comments/blank lines
 * and stopping at the `[DONE]` sentinel used by OpenAI-compatible APIs. */
export async function* readSseData(body: ReadableStream<Uint8Array> | null): AsyncGenerator<string> {
  for await (const line of readLines(body)) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice("data:".length).trim();
    if (data === "[DONE]") return;
    yield data;
  }
}
