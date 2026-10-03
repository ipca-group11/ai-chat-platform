import { useRef, type ChangeEvent } from "react";
import { Button } from "@app/ui";
import { Paperclip } from "lucide-react";
import { ALLOWED_EXTENSIONS } from "../model/validators";

export interface AttachmentPickerProps {
  onSelect: (files: FileList) => void;
  disabled?: boolean;
}

/** AC-66: lets the user attach one or more files to the message they are composing. */
export function AttachmentPicker({ onSelect, disabled }: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      onSelect(e.target.files);
    }
    e.target.value = "";
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        aria-label="Attach a file"
        className="sr-only"
        tabIndex={-1}
        multiple
        disabled={disabled}
        accept={ALLOWED_EXTENSIONS.join(",")}
        onChange={handleChange}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip aria-hidden="true" />
        Attach
      </Button>
    </>
  );
}
