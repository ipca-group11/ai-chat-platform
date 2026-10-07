/** Test-only helper: builds a `Response`-like object whose body streams the given text
 * chunks, for mocking `fetch` in provider adapter tests. */
export function mockStreamResponse(chunks: string[], init: { ok?: boolean; status?: number } = {}): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });

  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    body,
    json: async () => JSON.parse(chunks.join("")),
  } as unknown as Response;
}

/**
 * A `Response`-like object that behaves like real `fetch` with an abort signal:
 * - the body hands out **one chunk per read**, so tokens arrive over time;
 * - when `signal` aborts, the body is errored with an `AbortError` (WHATWG fetch "abort the
 *   fetch"), which also drops any chunk still queued.
 * `mockStreamResponse` ignores the signal, so it cannot show whether an adapter wired it.
 * `stats.cancelled` counts cancel() calls; `body.locked` shows whether a reader still holds it.
 */
export function mockAbortableStreamResponse(chunks: string[], signal: AbortSignal | undefined) {
  const encoder = new TextEncoder();
  const queue = [...chunks];
  const stats = { reads: 0, cancelled: 0 };
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;

  const abortError = () => new DOMException("The operation was aborted.", "AbortError");
  const body = new ReadableStream<Uint8Array>(
    {
      start(controller) {
        streamController = controller;
        if (signal?.aborted) controller.error(abortError());
      },
      pull(controller) {
        stats.reads += 1;
        const next = queue.shift();
        if (next === undefined) controller.close();
        else controller.enqueue(encoder.encode(next));
      },
      cancel() {
        stats.cancelled += 1;
      },
    },
    // highWaterMark 0: nothing is read ahead, a chunk is produced only when the consumer asks.
    { highWaterMark: 0 },
  );
  signal?.addEventListener("abort", () => streamController?.error(abortError()), { once: true });

  const response = { ok: true, status: 200, body } as unknown as Response;
  return { response, body, stats };
}

/** A `Response`-like object whose body rejects with the given error as soon as it's
 * read, for simulating a stream aborted mid-flight. */
export function mockErroringStreamResponse(error: unknown): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(error);
    },
  });

  return { ok: true, status: 200, body } as unknown as Response;
}

export function mockJsonErrorResponse(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    body: null,
    json: async () => body,
  } as unknown as Response;
}
