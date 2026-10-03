import type { Chat } from "../../../shared/types";
export interface ChatListItemProps {
    chat: Chat;
    active?: boolean;
    /** Open in another split-view pane (the focused one is `active`). */
    open?: boolean;
    /** The chat was shared with the current user: they can open it, but not rename or delete it. */
    shared?: boolean;
    onOpen: (chatId: string) => void;
    /**
     * Opens the chat in an additional split-view pane, right of (`horizontal`) or below
     * (`vertical`) the focused one; shows the split buttons when provided.
     */
    onOpenInSplit?: (chatId: string, direction: "horizontal" | "vertical") => void;
    onRename: (chatId: string, title: string) => void;
    onDelete: (chatId: string) => void;
}
/** AC-42: open, rename, delete a chat from the list. */
export declare function ChatListItem({ chat, active, open, shared, onOpen, onOpenInSplit, onRename, onDelete, }: ChatListItemProps): import("react").JSX.Element;
