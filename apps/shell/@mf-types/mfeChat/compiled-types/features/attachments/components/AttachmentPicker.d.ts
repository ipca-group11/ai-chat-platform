export interface AttachmentPickerProps {
    onSelect: (files: FileList) => void;
    disabled?: boolean;
}
/** AC-66: lets the user attach one or more files to the message they are composing. */
export declare function AttachmentPicker({ onSelect, disabled }: AttachmentPickerProps): import("react").JSX.Element;
