import { cn } from "@app/ui";
import type { Message } from "../../../shared/types";
import { MessageBubble } from "./MessageBubble";

export interface MessageListProps {
  messages: Message[];
  /** Tells your own messages apart from other members' in a shared chat. */
  currentUserId?: string;
  onStop: (messageId: string) => void;
  onRetry: (messageId: string) => void;
  retryingMessageId?: string;
  /** Show the model's reasoning above assistant replies (default: shown). */
  showReasoning?: boolean;
  /** Less padding around the empty state, for short split-view panes. */
  compact?: boolean;
}

/**
 * AC-53: shows the chat's full history (the same history sent to the LLM as
 * context). Only messages that are not `queued` are shown here — queued
 * messages are the `message-queue` feature's responsibility (AC-57).
 */
export function MessageList({
  messages,
  currentUserId,
  onStop,
  onRetry,
  retryingMessageId,
  showReasoning = true,
  compact = false,
}: MessageListProps) {
  const historyMessages = messages.filter((m) => m.status !== "queued");

  return (
    <div role="log" aria-label="Messages" aria-live="polite" data-testid="messages">
      {historyMessages.length === 0 ? (
        <div className={cn("flex flex-col items-center gap-1 text-center", compact ? "py-4" : "py-16")}>
          <p data-testid="messages-empty" className="text-sm font-medium">No messages yet. Say hello!</p>
          <p className="text-sm text-muted-foreground">Your conversation will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-6">
          {historyMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              currentUserId={currentUserId}
              onStop={onStop}
              onRetry={onRetry}
              retrying={retryingMessageId === message.id}
              showReasoning={showReasoning}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
