export interface MembersDialogProps {
    chatId: string;
    chatTitle: string;
    /** Owners can invite and remove; members can only view the list and leave. */
    isOwner: boolean;
    open: boolean;
    onClose: () => void;
    /** Called after the current user left the chat, so the page can navigate away. */
    onLeft?: () => void;
}
/** Lists who has access to a chat; the owner invites people by email. */
export declare function MembersDialog({ chatId, chatTitle, isOwner, open, onClose, onLeft }: MembersDialogProps): import("react").JSX.Element;
