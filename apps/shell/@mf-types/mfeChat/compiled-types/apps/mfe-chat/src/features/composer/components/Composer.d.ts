import type { Provider } from "../../../shared/types";
export interface ComposerProps {
    chatId: string;
    userId: string;
    provider: Provider;
    model?: string;
    /** One-line input with the actions beside it, for split-view panes short on height. */
    compact?: boolean;
}
/**
 * Message composer: text input, attachments, and send action.
 * AC-51 (send persists immediately), AC-56 (sending while busy queues, via the
 * server's response status), AC-66/67/68/71 (attachments).
 */
export declare function Composer({ chatId, userId, provider, model, compact }: ComposerProps): import("react").JSX.Element;
