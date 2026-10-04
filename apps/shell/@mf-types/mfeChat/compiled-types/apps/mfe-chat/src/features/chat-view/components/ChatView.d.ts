export interface ChatViewProps {
    chatId: string;
    userId: string;
    /** Returns to the chat list (shown on small screens, where only one pane is visible). */
    onBack?: () => void;
    /** Closes this chat's pane in split view; renders a close button when provided. */
    onClose?: () => void;
    /** Tighter spacing, for when the chat shares the screen with other split-view panes. */
    compact?: boolean;
}
/**
 * Top-level view for a single open chat: history + streaming (AC-51..AC-55),
 * the message queue (AC-56..AC-59), and parallel-session support (AC-60/AC-61,
 * via `useMessageStream`'s module-level subscription). AC-46: a 403/404 on the
 * chat itself renders a clear not-found/error state instead of any message data.
 */
export declare function ChatView({ chatId, userId, onBack, onClose, compact }: ChatViewProps): import("react").JSX.Element;
