/** Why `DELETE /auth/me` failed: the HTTP status (0 when the request never got an answer) and auth-service's error code. */
export declare class DeleteAccountError extends Error {
    readonly status: number;
    readonly code: string | undefined;
    constructor(status: number, code: string | undefined, message: string);
}
/**
 * Deletes the signed-in user's account with `DELETE /auth/me` (auth-service): the password is
 * sent again in the body (`{ password }`), and on success (204) auth-service has erased the
 * account and everything it owns and cleared the session cookies.
 */
export declare function deleteAccount(password: string): Promise<void>;
