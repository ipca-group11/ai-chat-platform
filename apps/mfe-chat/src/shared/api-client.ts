import { CORRELATION_HEADER, LLM_API_KEY_HEADER, type Provider } from "./types";

/**
 * Base URL of `services/conversation-service`. In the real deployment this is
 * provided by the shell's runtime config; falls back to a same-origin `/api`
 * proxy path for local dev.
 */
const BASE_URL =
  (typeof window !== "undefined" && (window as unknown as { __CONVERSATION_API_URL__?: string }).__CONVERSATION_API_URL__) ||
  "/api";

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

function correlationId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `corr-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * Namespaced sessionStorage key convention shared with `mfe-settings` (owner of
 * FR17-FR20 / AC-82/AC-83). Kept here rather than duplicated per call site so
 * the single place to change if the settings pod's exact format differs is
 * this function (see docs/pods/chat/PLAN.md §7 risk).
 */
export function readLlmApiKey(userId: string, provider: Provider): string | null {
  // `llm-api-key:*` in localStorage is only a masked record (last 4 chars) for display;
  // the usable key is kept per tab session (`@app/shared-types/api-keys`
  // `buildSessionApiKeyStorageKey`).
  if (provider === "ollama" || typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(`llm-api-key-session:${userId}:${provider}`);
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** When set, attaches the `X-Llm-Api-Key` header read from local storage. */
  llmKey?: { userId: string; provider: Provider };
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, llmKey, headers, ...rest } = options;
  const finalHeaders = new Headers(headers);
  finalHeaders.set(CORRELATION_HEADER, correlationId());
  if (body !== undefined && !(body instanceof FormData)) {
    finalHeaders.set("Content-Type", "application/json");
  }
  if (llmKey) {
    const key = readLlmApiKey(llmKey.userId, llmKey.provider);
    if (key) finalHeaders.set(LLM_API_KEY_HEADER, key);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: finalHeaders,
    body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });

  if (!res.ok) {
    let message = res.statusText;
    let code: string | undefined;
    try {
      // conversation-service answers every error with `{ error: { code, message } }`
      // (`toErrorResponse`); pinned by the pact tests.
      const payload = (await res.json()) as { error?: { message?: string; code?: string } };
      message = payload.error?.message ?? message;
      code = payload.error?.code;
    } catch {
      // no JSON body, fall back to statusText
    }
    throw new ApiError(res.status, message, code);
  }

  if (res.status === 204) return undefined as T;
  return unwrapEnvelope(await res.json()) as T;
}

/**
 * conversation-service wraps every body in a single-key envelope ({ chat }, { chats },
 * { messages }, …); the hooks here work with the value itself.
 */
function unwrapEnvelope(body: unknown): unknown {
  if (body && typeof body === "object" && !Array.isArray(body)) {
    const keys = Object.keys(body);
    if (keys.length === 1) {
      const value = (body as Record<string, unknown>)[keys[0]!];
      if (value && typeof value === "object") return value;
    }
  }
  return body;
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
  baseUrl: BASE_URL,
};
