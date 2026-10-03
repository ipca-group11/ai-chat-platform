import type { Message } from "../../../shared/types";
import { useMessageQueue } from "../hooks/useMessageQueue";
import { selectQueuedMessages } from "../model/select-queued";
import { QueuedMessageItem } from "./QueuedMessageItem";

export interface MessageQueueProps {
  chatId: string;
  messages: Message[];
  /** In a shared chat only your own queued messages can be edited or canceled. */
  currentUserId?: string;
}

/** AC-56/AC-57: renders this chat's FIFO queue of not-yet-processed messages. */
export function MessageQueue({ chatId, messages, currentUserId }: MessageQueueProps) {
  const queued = selectQueuedMessages(messages);
  const { editMessage, cancelMessage } = useMessageQueue(chatId);

  if (queued.length === 0) return null;

  return (
    <section aria-label="Queued messages" className="mt-6 rounded-lg border border-dashed border-border p-3">
      <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Queued ({queued.length})
      </h2>
      <ul className="space-y-1">
        {queued.map((message) => (
          <QueuedMessageItem
            key={message.id}
            message={message}
            onEdit={editMessage}
            onCancel={cancelMessage}
            editable={!currentUserId || !message.authorId || message.authorId === currentUserId}
          />
        ))}
      </ul>
    </section>
  );
}
