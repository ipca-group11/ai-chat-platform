import type { Message } from "../../../shared/types";
/**
 * AC-56/AC-57: messages waiting behind the current response are shown in a
 * distinct queued state. AC-59: they are processed one at a time, in order —
 * `conversation-service` owns that ordering; this just renders it in the same
 * (creation) order the server already returns.
 */
export declare function selectQueuedMessages(messages: Message[]): Message[];
