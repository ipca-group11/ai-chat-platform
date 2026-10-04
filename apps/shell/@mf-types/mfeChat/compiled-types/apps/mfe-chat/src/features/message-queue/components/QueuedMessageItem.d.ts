import type { Message } from "../../../shared/types";
export interface QueuedMessageItemProps {
    message: Message;
    onEdit: (messageId: string, content: string) => void;
    onCancel: (messageId: string) => void;
    /** False for another member's message: shown, but without edit/cancel. */
    editable?: boolean;
}
/** AC-57 (queued state), AC-58 (edit/cancel before processing starts). */
export declare function QueuedMessageItem({ message, onEdit, onCancel, editable }: QueuedMessageItemProps): import("react").JSX.Element;
