import type { PendingAttachment } from "../hooks/usePendingAttachments";
export interface AttachmentListProps {
    attachments: PendingAttachment[];
    onRemove: (id: string) => void;
}
/** AC-67/AC-68/AC-71: shows each staged attachment's state, including a clear rejection reason. */
export declare function AttachmentList({ attachments, onRemove }: AttachmentListProps): import("react").JSX.Element | null;
