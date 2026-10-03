export declare class ApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
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
export declare function apiFetch<T = unknown>(path: string, options?: ApiFetchOptions): Promise<T>;
