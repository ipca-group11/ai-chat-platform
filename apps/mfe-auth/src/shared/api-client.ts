import { CORRELATION_HEADER, generateCorrelationId } from "./correlation";

// Base URL of `auth-service`. Configurable per environment; defaults to same-origin
// (`/auth/...`) when the shell proxies requests, or can be overridden for local dev.
const AUTH_SERVICE_BASE_URL: string =
  (import.meta.env?.VITE_AUTH_SERVICE_URL as string | undefined) ?? "";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

/**
 * Fetch wrapper for `auth-service` calls.
 * - Always sends `credentials: 'include'` so the httpOnly `access_token`/`refresh_token`
 *   cookies are attached (STACK.md decision #1).
 * - Injects the correlation-id header (STACK.md decision #8) when the caller hasn't
 *   already set one.
 * - Normalizes non-2xx responses into a single `ApiError` carrying the server's message.
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, headers: headersInit, ...rest } = options;
  const headers = new Headers(headersInit);

  if (!headers.has(CORRELATION_HEADER)) {
    headers.set(CORRELATION_HEADER, generateCorrelationId());
  }

  let serializedBody: BodyInit | undefined;
  if (body !== undefined) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    serializedBody = JSON.stringify(body);
  }

  const response = await fetch(`${AUTH_SERVICE_BASE_URL}${path}`, {
    ...rest,
    method: rest.method ?? (body !== undefined ? "POST" : "GET"),
    headers,
    credentials: "include",
    body: serializedBody,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await extractErrorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}

async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const data = await response.clone().json();
    if (data && typeof data.error === "string") {
      return data.error;
    }
    if (data && typeof data.message === "string") {
      return data.message;
    }
  } catch {
    // Body wasn't JSON (or was empty); fall through to the status text.
  }
  return response.statusText || "Request failed";
}
