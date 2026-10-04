import type { Message } from "../../../shared/types";
export interface MessageQueueProps {
    chatId: string;
    messages: Message[];
    /** In a shared chat only your own queued messages can be edited or canceled. */
    currentUserId?: string;
}
/** AC-56/AC-57: renders this chat's FIFO queue of not-yet-processed messages. */
export declare function MessageQueue({ chatId, messages, currentUserId }: MessageQueueProps): import("react").JSX.Element | null;
