import type { Message } from "../../../shared/types";
export interface MessageListProps {
    messages: Message[];
    /** Tells your own messages apart from other members' in a shared chat. */
    currentUserId?: string;
    onStop: (messageId: string) => void;
    onRetry: (messageId: string) => void;
    retryingMessageId?: string;
    /** Show the model's reasoning above assistant replies (default: shown). */
    showReasoning?: boolean;
    /** Less padding around the empty state, for short split-view panes. */
    compact?: boolean;
}
/**
 * AC-53: shows the chat's full history (the same history sent to the LLM as
 * context). Only messages that are not `queued` are shown here — queued
 * messages are the `message-queue` feature's responsibility (AC-57).
 */
export declare function MessageList({ messages, currentUserId, onStop, onRetry, retryingMessageId, showReasoning, compact, }: MessageListProps): import("react").JSX.Element;
