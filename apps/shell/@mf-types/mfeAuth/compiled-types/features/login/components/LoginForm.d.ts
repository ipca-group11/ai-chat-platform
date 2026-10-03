/**
 * Login form (PLAN.md F3), built from `@app/ui` components. Client-side validation only
 * checks that both fields are present (AC-36: the server is the sole source of truth for
 * which credentials are wrong, so we never guess client-side). On success, navigates to
 * the chat list route (AC-35). On failure, renders the single generic error message
 * returned by the API as-is (AC-36).
 */
export declare function LoginForm(): import("react").JSX.Element;
