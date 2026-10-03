/** Minimal shape this app needs from auth-service's `GET /auth/me`. */
export interface CurrentUser {
    id: string;
    email: string;
}
/**
 * Resolves the signed-in user through the httpOnly session cookie. Same-origin by
 * default (the shell proxies `/auth` to auth-service).
 */
export declare function fetchCurrentUser(): Promise<CurrentUser>;
