import { useState } from "react";
import { Button, Textarea } from "@app/ui";
import { Clock, Pencil, X } from "lucide-react";
import type { Message } from "../../../shared/types";

export interface QueuedMessageItemProps {
  message: Message;
  onEdit: (messageId: string, content: string) => void;
  onCancel: (messageId: string) => void;
  /** False for another member's message: shown, but without edit/cancel. */
  editable?: boolean;
}

/** AC-57 (queued state), AC-58 (edit/cancel before processing starts). */
export function QueuedMessageItem({ message, onEdit, onCancel, editable = true }: QueuedMessageItemProps) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(message.content);

  if (editing) {
    return (
      <li data-testid={`queued-${message.id}`} className="space-y-2 rounded-md bg-muted/40 p-2">
        <Textarea aria-label="Edit queued message" value={content} onChange={(e) => setContent(e.target.value)} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
            Cancel edit
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onEdit(message.id, content);
              setEditing(false);
            }}
          >
            Save
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li data-testid={`queued-${message.id}`} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/40">
      <Clock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="min-w-0 flex-1 truncate text-sm">{message.content}</p>
      {!editable && message.authorEmail ? (
        <span className="shrink-0 truncate text-xs text-muted-foreground">{message.authorEmail}</span>
      ) : null}
      {editable ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${message.content}`}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7 text-muted-foreground hover:text-destructive"
            onClick={() => onCancel(message.id)}
            aria-label={`Cancel ${message.content}`}
          >
            <X className="size-3.5" aria-hidden="true" />
          </Button>
        </>
      ) : null}
    </li>
  );
}
