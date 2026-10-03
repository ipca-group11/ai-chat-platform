import { CORRELATION_HEADER } from './constants';

export class ApiError extends Error {
  readonly status: number;
  readonly correlationId: string | undefined;

  constructor(message: string, status: number, correlationId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.correlationId = correlationId;
  }
}

/** True when the response represents an unauthenticated/expired session. */
export function isUnauthorizedError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 401;
}

function generateCorrelationId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback UUID v4-ish generator for environments without crypto.randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface ApiClientOptions extends RequestInit {
  /** Base URL prefix; defaults to same-origin relative requests. */
  baseUrl?: string;
}

/**
 * Fetch wrapper shared across the shell and (via federation) its remotes.
 * - Sends cookies for the httpOnly session cookie (decision #1 in STACK.md).
 * - Attaches the correlation id header, generating one when absent, per
 *   ARCHITECTURE.md §7.
 * - Normalizes non-2xx responses (in particular 401) into `ApiError` so
 *   callers (e.g. `useSession`) can branch on `isUnauthorizedError`.
 */
export async function apiFetch<T>(path: string, options: ApiClientOptions = {}): Promise<T> {
  const { baseUrl = '', headers, ...rest } = options;

  const outgoingHeaders = new Headers(headers);
  if (!outgoingHeaders.has(CORRELATION_HEADER)) {
    outgoingHeaders.set(CORRELATION_HEADER, generateCorrelationId());
  }

  const response = await fetch(`${baseUrl}${path}`, {
    credentials: 'include',
    ...rest,
    headers: outgoingHeaders,
  });

  const correlationId = response.headers.get(CORRELATION_HEADER) ?? undefined;

  if (!response.ok) {
    throw new ApiError(`Request to ${path} failed with status ${response.status}`, response.status, correlationId);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
