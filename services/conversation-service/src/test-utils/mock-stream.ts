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
