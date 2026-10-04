/**
 * Client for conversation-service's internal erasure endpoint (AICHAT-79). Used when an
 * account is deleted, by `DELETE /auth/me` and by the inactive-account retention job.
 */
export interface ErasureClient {
  /** Asks conversation-service to delete everything the user has there. Resolves when it
   * is done (repeating the call is safe) and rejects on any failure. */
  eraseUser(userId: string, email: string): Promise<void>;
}

export interface ErasureClientOptions {
  baseUrl: string;
  token: string;
  /** Replaced in tests. */
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createErasureClient({ baseUrl, token, fetchImpl = fetch, timeoutMs = 15_000 }: ErasureClientOptions): ErasureClient {
  const url = new URL("/internal/erasures", baseUrl);
  return {
    async eraseUser(userId, email) {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId, email }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        throw new Error(`conversation-service erasure failed with status ${response.status}`);
      }
    },
  };
}
