export interface ChatListProps {
    activeChatId?: string;
    /** Chats owned by someone else are marked as shared with you. */
    currentUserId?: string;
    /** Chats open in another split-view pane (highlighted, but not the focused one). */
    openChatIds?: string[];
    onOpenChat: (chatId: string) => void;
    /** Opens a chat in an additional split-view pane, right of or below the focused one. */
    onOpenChatInSplit?: (chatId: string, direction: "horizontal" | "vertical") => void;
    /** Called after a chat was deleted, so the page can close it if it is open. */
    onChatDeleted?: (chatId: string) => void;
}
/** AC-42, AC-47: lists only the chats the server returns for the current user (their own
 * plus those shared with them). */
export declare function ChatList({ activeChatId, currentUserId, openChatIds, onOpenChat, onOpenChatInSplit, onChatDeleted, }: ChatListProps): import("react").JSX.Element;
