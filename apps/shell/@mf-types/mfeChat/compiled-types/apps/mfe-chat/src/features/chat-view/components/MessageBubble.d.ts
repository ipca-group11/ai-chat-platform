import type { Message } from "../../../shared/types";
export interface MessageBubbleProps {
    message: Message;
    /** When set, user messages written by someone else are labeled with their email. */
    currentUserId?: string;
    onStop?: (messageId: string) => void;
    onRetry?: (messageId: string) => void;
    retrying?: boolean;
    /** Show the model's reasoning above assistant replies that have any (default: shown). */
    showReasoning?: boolean;
}
/** AC-52 (incremental content), AC-54 (stop), AC-57 (distinct queued state), AC-72/73 (error + retry). */
export declare function MessageBubble({ message, currentUserId, onStop, onRetry, retrying, showReasoning }: MessageBubbleProps): import("react").JSX.Element;
