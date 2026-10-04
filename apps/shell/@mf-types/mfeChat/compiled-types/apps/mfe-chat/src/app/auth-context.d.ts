import { type ReactNode } from "react";
export declare function CurrentUserProvider({ userId, children }: {
    userId: string;
    children: ReactNode;
}): import("react").JSX.Element;
/**
 * Renders `children` inside a `CurrentUserProvider`. Reuses an id provided higher up;
 * otherwise loads it from `GET /auth/me` (the shell's guard has already checked the
 * session, so this normally resolves immediately).
 */
export declare function CurrentUserGate({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
export declare function useCurrentUserId(): string;
