export interface DeleteAccountCardProps {
    /** Runs once the account is gone. Defaults to a full page load of `/login`, which also drops
     * everything the old session left in memory. */
    onDeleted?: () => void;
}
/**
 * "Delete account" on the settings page: a confirmation dialog asks for the password again and
 * sends `DELETE /auth/me`, which erases the account and everything it owns and ends the
 * session. Then the user's keys and cached data are dropped and they are sent to sign in.
 */
export declare function DeleteAccountCard({ onDeleted }: DeleteAccountCardProps): import("react").JSX.Element | null;
