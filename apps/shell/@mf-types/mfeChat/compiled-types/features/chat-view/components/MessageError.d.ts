import type { Message } from "../../../shared/types";
export interface MessageErrorProps {
    message: Message;
    onRetry: (messageId: string) => void;
    retrying?: boolean;
}
/**
 * AC-72: surfaces a provider error/timeout/rate-limit to the user without crashing the chat.
 * AC-73: lets the user retry a message that failed due to a provider error.
 */
export declare function MessageError({ message, onRetry, retrying }: MessageErrorProps): import("react").JSX.Element | null;
