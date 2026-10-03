import { AttachmentList, AttachmentPicker } from "../../attachments";
import { Button, Textarea, cn } from "@app/ui";
import { SendHorizontal } from "lucide-react";
import type { Provider } from "../../../shared/types";
import { useComposer } from "../hooks/useComposer";

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
export function Composer({ chatId, userId, provider, model = "", compact = false }: ComposerProps) {
  const composer = useComposer({ chatId, userId, provider, model });

  return (
    <div className="space-y-2">
      <form
        className="rounded-xl border border-input bg-background shadow-sm transition-shadow focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
        onSubmit={(e) => {
          e.preventDefault();
          composer.send();
        }}
      >
        <AttachmentList attachments={composer.attachments.pending} onRemove={composer.attachments.removePending} />
        <div className={cn(compact && "flex items-end")}>
          <Textarea
            aria-label="Message"
            placeholder={compact ? "Send a message…" : "Send a message…  (Shift+Enter for a new line)"}
            rows={compact ? 1 : 2}
            className={cn(
              "resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 focus-visible:ring-offset-0",
              compact ? "min-h-0 min-w-0 flex-1" : "min-h-[56px]"
            )}
            value={composer.content}
            onChange={(e) => composer.setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                composer.send();
              }
            }}
          />
          <div className={cn("flex items-center gap-2 px-2", compact ? "shrink-0 py-1" : "justify-between pb-2")}>
            <AttachmentPicker onSelect={(files) => composer.attachments.addFiles(files)} />
            <Button type="submit" size="sm" disabled={!composer.canSend} loading={composer.isSending}>
              Send
              {composer.isSending ? null : <SendHorizontal aria-hidden="true" />}
            </Button>
          </div>
        </div>
      </form>
      {composer.sendError && (
        <p role="alert" className="text-sm font-medium text-destructive">
          {composer.sendError.message}
        </p>
      )}
    </div>
  );
}
