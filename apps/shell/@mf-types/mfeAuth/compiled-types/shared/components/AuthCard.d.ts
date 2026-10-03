import type { ReactNode } from "react";
export interface AuthCardProps {
    title: string;
    description: string;
    children: ReactNode;
    /** Link to the sibling screen, e.g. "Don't have an account?" → /register. */
    switchPrompt: string;
    switchLabel: string;
    switchTo: "/login" | "/register";
}
/** Centered card shared by the login and registration screens. */
export declare function AuthCard({ title, description, children, switchPrompt, switchLabel, switchTo }: AuthCardProps): import("react").JSX.Element;
