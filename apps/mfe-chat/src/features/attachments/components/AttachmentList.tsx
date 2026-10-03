import { Badge, Button, cn } from "@app/ui";
import { FileText, X } from "lucide-react";
import type { PendingAttachment } from "../hooks/usePendingAttachments";

export interface AttachmentListProps {
  attachments: PendingAttachment[];
  onRemove: (id: string) => void;
}

/** AC-67/AC-68/AC-71: shows each staged attachment's state, including a clear rejection reason. */
export function AttachmentList({ attachments, onRemove }: AttachmentListProps) {
  if (attachments.length === 0) return null;

  return (
    <ul aria-label="Attachments" className="flex flex-wrap gap-2 px-3 pt-3">
      {attachments.map((pending) => {
        const rejected = pending.status === "rejected";
        return (
          <li
            key={pending.id}
            data-testid={`attachment-${pending.id}`}
            className={cn(
              "flex max-w-full items-center gap-2 rounded-md border bg-muted/50 py-1 pl-2 pr-1 text-xs",
              rejected ? "border-destructive/50" : "border-border"
            )}
          >
            <FileText className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate font-medium">{pending.file.name}</span>
            {rejected ? (
              <span role="alert" className="text-destructive">
                {pending.error}
              </span>
            ) : (
              <Badge variant={pending.status === "uploaded" ? "success" : "secondary"} className="px-1.5 py-0 text-[10px]">
                {pending.status}
              </Badge>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-6"
              onClick={() => onRemove(pending.id)}
              aria-label={`Remove ${pending.file.name}`}
            >
              <X className="size-3" aria-hidden="true" />
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
