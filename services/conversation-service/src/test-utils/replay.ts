import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Test-only helpers that replay recorded provider responses (AICHAT-25). Fixtures are
 * the raw bytes of a real (or documented) response; the replay cuts them into uneven
 * chunks, the way a network does, so line and UTF-8 boundaries are exercised. */

export type FixtureProvider = "anthropic" | "openai";

export const FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "llm");

/** Chunk sizes cycled through when none are given: 1, 7, 64 and 3 bytes, repeated. */
export const DEFAULT_CHUNK_SIZES: readonly number[] = [1, 7, 64, 3];

export function readFixture(provider: FixtureProvider, file: string): Buffer {
  return readFileSync(join(FIXTURES_DIR, provider, file));
}

/** Cuts `bytes` into consecutive pieces whose sizes cycle through `sizes`. */
export function splitBytes(bytes: Uint8Array, sizes: readonly number[] = DEFAULT_CHUNK_SIZES): Uint8Array[] {
  if (sizes.length === 0 || sizes.some((size) => !Number.isInteger(size) || size < 1)) {
    throw new Error("chunk sizes must be positive integers");
  }
  const chunks: Uint8Array[] = [];
  let offset = 0;
  for (let i = 0; offset < bytes.length; i++) {
    const size = sizes[i % sizes.length] as number;
    chunks.push(bytes.slice(offset, offset + size));
    offset += size;
  }
  return chunks;
}

/** Cuts `bytes` at the given absolute offsets (e.g. `[5]` gives two chunks). */
export function splitAtOffsets(bytes: Uint8Array, offsets: readonly number[]): Uint8Array[] {
  const cuts = [0, ...offsets, bytes.length];
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i] as number;
    const end = cuts[i + 1] as number;
    if (end < start || end > bytes.length) throw new Error("offsets must be ascending and inside the body");
    if (end > start) chunks.push(bytes.slice(start, end));
  }
  return chunks;
}

/** A real `Response` whose body delivers exactly the given chunks, one read each. */
export function responseFromChunks(chunks: Uint8Array[], init: ResponseInit = {}): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
  return new Response(body, init);
}

export interface ReplaySseOptions {
  /** Chunk sizes in bytes, cycled. Defaults to {@link DEFAULT_CHUNK_SIZES}. */
  chunkSizes?: readonly number[];
  /** Explicit cut points (byte offsets); takes precedence over `chunkSizes`. */
  splitAt?: readonly number[];
}

/** Replays `fixtures/llm/<provider>/<name>.sse` as a 200 event stream. */
export function replaySse(provider: FixtureProvider, name: string, options: ReplaySseOptions = {}): Response {
  const bytes = readFixture(provider, `${name}.sse`);
  const chunks = options.splitAt ? splitAtOffsets(bytes, options.splitAt) : splitBytes(bytes, options.chunkSizes);
  return responseFromChunks(chunks, { status: 200, headers: { "content-type": "text/event-stream" } });
}

/** Replays `fixtures/llm/<provider>/http-<status>.json` as an error response. */
export function replayHttpError(provider: FixtureProvider, status: number): Response {
  const bytes = readFixture(provider, `http-${status}.json`);
  return new Response(bytes, { status, headers: { "content-type": "application/json" } });
}

export interface RecordedRequest {
  url: string;
  init: RequestInit;
  /** The JSON request body, parsed. */
  body: unknown;
}

export interface ReplayFetch {
  fetch: typeof fetch;
  /** Every request made so far, in order. */
  requests: RecordedRequest[];
}

/** A `fetch` that answers call n with `responses[n]` and records the requests, so a test can
 * check what the adapter sent (e.g. the `pause_turn` continuation). Fails if called more
 * often than there are responses. */
export function replayFetch(...responses: Response[]): ReplayFetch {
  const requests: RecordedRequest[] = [];
  const replay = (input: Parameters<typeof fetch>[0], init: RequestInit = {}): Promise<Response> => {
    const response = responses[requests.length];
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body: unknown = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    requests.push({ url, init, body });
    if (!response) return Promise.reject(new Error(`replayFetch: no response left for request ${requests.length}`));
    return Promise.resolve(response);
  };
  return { fetch: replay as typeof fetch, requests };
}
