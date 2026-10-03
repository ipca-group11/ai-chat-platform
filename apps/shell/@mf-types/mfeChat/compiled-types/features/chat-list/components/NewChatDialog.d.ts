import type { Provider } from "../../../shared/types";
export interface NewChatDialogProps {
    open: boolean;
    onClose: () => void;
    onCreate: (input: {
        title: string;
        provider: Provider;
        model: string;
        reasoning?: boolean;
        webFetch?: boolean;
    }) => void;
    submitting?: boolean;
}
/** AC-42 (create), AC-48 (provider/model chosen at creation time). */
export declare function NewChatDialog({ open, onClose, onCreate, submitting }: NewChatDialogProps): import("react").JSX.Element;
