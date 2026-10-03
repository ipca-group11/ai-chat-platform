/**
 * Minimal shape this app needs from `GET /auth/me` (owned by `auth-service`, `auth`
 * pod). Kept local rather than depending on a not-yet-published `packages/shared-types`
 * auth DTO — only the fields actually used here.
 */
export interface CurrentUser {
    id: string;
    email: string;
}
export declare class AuthError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
/**
 * Resolves the currently logged-in user so stored API keys can be namespaced by
 * `userId` (AC-78, AC-80). Sends the httpOnly session cookie (`credentials: 'include'`)
 * rather than any bearer token, per `docs/ARCHITECTURE.md` §4.
 */
export declare function fetchCurrentUser(): Promise<CurrentUser>;
