import { type Provider } from "./types";
export declare class ApiError extends Error {
    status: number;
    code?: string;
    constructor(status: number, message: string, code?: string);
}
/**
 * Namespaced sessionStorage key convention shared with `mfe-settings` (owner of
 * FR17-FR20 / AC-82/AC-83). Kept here rather than duplicated per call site so
 * the single place to change if the settings pod's exact format differs is
 * this function (see docs/pods/chat/PLAN.md §7 risk).
 */
export declare function readLlmApiKey(userId: string, provider: Provider): string | null;
export interface RequestOptions extends Omit<RequestInit, "body"> {
    body?: unknown;
    /** When set, attaches the `X-Llm-Api-Key` header read from local storage. */
    llmKey?: {
        userId: string;
        provider: Provider;
    };
}
export declare const apiClient: {
    get: <T>(path: string, options?: RequestOptions) => Promise<T>;
    post: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>;
    patch: <T>(path: string, body?: unknown, options?: RequestOptions) => Promise<T>;
    delete: <T>(path: string, options?: RequestOptions) => Promise<T>;
    baseUrl: string;
};
