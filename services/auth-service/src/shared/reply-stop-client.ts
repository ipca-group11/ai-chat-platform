/**
 * Client for conversation-service's internal "stop the user's replies" endpoint (AICHAT-203).
 * Logout calls it so replies the user started stop spending their API key. Same service token
 * and base URL as the erasure client.
 */
export interface ReplyStopClient {
  /** Stops every reply `userId` started. Resolves with how many stopped; rejects on any failure. */
  stopUserReplies(userId: string): Promise<number>;
}

export interface ReplyStopClientOptions {
  baseUrl: string;
  token: string;
  /** Replaced in tests. */
  fetchImpl?: typeof fetch;
  /** Logout waits at most this long; short because it is best-effort. */
  timeoutMs?: number;
}

export function createReplyStopClient({ baseUrl, token, fetchImpl = fetch, timeoutMs = 2_000 }: ReplyStopClientOptions): ReplyStopClient {
  return {
    async stopUserReplies(userId) {
      const url = new URL(`/internal/sessions/${encodeURIComponent(userId)}/stop`, baseUrl);
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        throw new Error(`conversation-service reply stop failed with status ${response.status}`);
      }
      const body = (await response.json()) as { stopped?: number };
      return body.stopped ?? 0;
    },
  };
}
