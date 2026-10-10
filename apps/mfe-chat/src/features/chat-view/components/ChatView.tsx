import { useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle, Badge, Button, Skeleton, cn } from "@app/ui";
import { ArrowLeft, Brain, CircleAlert, Eye, EyeOff, Globe, Users, WifiOff, X } from "lucide-react";
import { MembersDialog } from "../../chat-members";
import { useChat, useUpdateChat } from "../../chat-list";
import { Composer } from "../../composer";
import { MessageQueue } from "../../message-queue";
import { supportsReasoning, supportsWebFetch } from "../../../shared/model-capabilities";
import { useMessages, useRetryMessage, useStopMessage } from "../api/messages";
import { useChatReconnecting, useMessageStream } from "../hooks/useMessageStream";
import { useShowReasoning } from "../model/show-reasoning";
import { MessageList } from "./MessageList";

export interface ChatViewProps {
  chatId: string;
  userId: string;
  /** Returns to the chat list (shown on small screens, where only one pane is visible). */
  onBack?: () => void;
  /** Closes this chat's pane in split view; renders a close button when provided. */
  onClose?: () => void;
  /** Tighter spacing, for when the chat shares the screen with other split-view panes. */
  compact?: boolean;
}

/**
 * Top-level view for a single open chat: history + streaming (AC-51..AC-55),
 * the message queue (AC-56..AC-59), and parallel-session support (AC-60/AC-61,
 * via `useMessageStream`'s module-level subscription). AC-46: a 403/404 on the
 * chat itself renders a clear not-found/error state instead of any message data.
 */
export function ChatView({ chatId, userId, onBack, onClose, compact = false }: ChatViewProps) {
  const chatQuery = useChat(chatId);
  const messagesQuery = useMessages(chatId);
  const stopMessage = useStopMessage();
  const retryMessage = useRetryMessage();
  const updateChat = useUpdateChat();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [showReasoning, setShowReasoning] = useShowReasoning();

  useMessageStream(chatId);
  const reconnecting = useChatReconnecting(chatId);

  const closeButton = onClose ? (
    <Button type="button" variant="ghost" size="icon" className="size-8 shrink-0" onClick={onClose} aria-label="Close pane" data-pane-close="">
      <X aria-hidden="true" />
    </Button>
  ) : null;

  const messages = messagesQuery.data ?? [];
  const lastMessage = messages[messages.length - 1];

  // Keep the newest message (and streamed tokens) in view.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, lastMessage?.content]);

  if (chatQuery.isError) {
    const status = chatQuery.error.status;
    const notFound = status === 403 || status === 404;
    return (
      <div className="relative flex flex-1 flex-col">
        {closeButton ? <div className="absolute right-2 top-2">{closeButton}</div> : null}
        <div className="mx-auto w-full max-w-lg px-4 py-10">
          <Alert variant="destructive">
            <CircleAlert />
            <AlertTitle>
              <h1 data-testid="chat-error-heading">{notFound ? "Chat not found" : "Could not load this chat"}</h1>
            </AlertTitle>
            <AlertDescription>
              <p data-testid="chat-error-text">
                {notFound
                  ? "Chat not found. It may have been deleted, or you no longer have access to it."
                  : "Something went wrong while loading this chat. Please try again."}
              </p>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  if (chatQuery.isLoading || !chatQuery.data) {
    return (
      <div className="flex flex-1 flex-col gap-4 p-6">
        <span className="sr-only">Loading chat…</span>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="ml-auto h-10 w-1/2" />
      </div>
    );
  }

  const chat = chatQuery.data;
  const isOwner = chat.ownerId === userId;
  const reasoningOn = chat.reasoning ?? false;
  const canReason = supportsReasoning(chat.provider, chat.model);
  // Also offered when the model changed since, so older replies' reasoning can be hidden.
  const hasReasoning = canReason || messages.some((m) => m.reasoning);
  const webFetchOn = chat.webFetch ?? false;
  const canFetch = supportsWebFetch(chat.provider, chat.model);
  // Both toggles share one mutation; only the one being changed shows as loading.
  const updating = (field: "reasoning" | "webFetch") => updateChat.isPending && updateChat.variables?.[field] !== undefined;

  return (
    <section aria-label={chat.title} className="flex min-h-0 flex-1 flex-col">
      <header className={cn("flex items-center gap-2 border-b border-border px-4", compact ? "py-2" : "py-3")}>
        {onBack ? (
          <Button type="button" variant="ghost" size="icon" className="size-8 md:hidden" onClick={onBack} aria-label="Back to chats">
            <ArrowLeft aria-hidden="true" />
          </Button>
        ) : null}
        <h1 data-testid="chat-heading" className="min-w-0 truncate text-base font-semibold tracking-tight">{chat.title}</h1>
        {/* In a narrow split pane the badge truncates and the share button drops its label,
            so the title keeps its room. */}
        <Badge
          variant="secondary"
          className={cn("ml-auto font-medium", compact ? "min-w-0" : "shrink-0")}
          title={`${chat.provider}/${chat.model}`}
        >
          <span className="truncate">
            {chat.provider}/{chat.model}
          </span>
        </Badge>
        {canReason ? (
          // Owner-only, like changing the model; members see the current setting.
          <Button
            type="button"
            variant={reasoningOn ? "secondary" : "outline"}
            size={compact ? "icon" : "sm"}
            className={cn("shrink-0", compact ? "size-8" : "h-8", reasoningOn && "text-primary")}
            aria-label="Reasoning"
            aria-pressed={reasoningOn}
            title={
              isOwner
                ? `Reasoning ${reasoningOn ? "on" : "off"}: click to turn it ${reasoningOn ? "off" : "on"}`
                : `Reasoning ${reasoningOn ? "on" : "off"} (only the owner can change it)`
            }
            disabled={!isOwner}
            loading={updating("reasoning")}
            onClick={() => updateChat.mutate({ chatId, reasoning: !reasoningOn })}
          >
            <Brain aria-hidden="true" />
            {compact ? null : <span className="hidden sm:inline">{reasoningOn ? "Reasoning on" : "Reasoning off"}</span>}
          </Button>
        ) : null}
        {canFetch ? (
          // Owner-only, like reasoning.
          <Button
            type="button"
            variant={webFetchOn ? "secondary" : "outline"}
            size={compact ? "icon" : "sm"}
            className={cn("shrink-0", compact ? "size-8" : "h-8", webFetchOn && "text-primary")}
            aria-label="Web fetch"
            aria-pressed={webFetchOn}
            title={
              isOwner
                ? `Web fetch ${webFetchOn ? "on" : "off"}: click to turn it ${webFetchOn ? "off" : "on"}`
                : `Web fetch ${webFetchOn ? "on" : "off"} (only the owner can change it)`
            }
            disabled={!isOwner}
            loading={updating("webFetch")}
            onClick={() => updateChat.mutate({ chatId, webFetch: !webFetchOn })}
          >
            <Globe aria-hidden="true" />
            {compact ? null : <span className="hidden sm:inline">{webFetchOn ? "Web on" : "Web off"}</span>}
          </Button>
        ) : null}
        {hasReasoning ? (
          // A display preference for this browser, so anyone can flip it, owner or not.
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0"
            aria-label="Show thinking"
            aria-pressed={showReasoning}
            title={showReasoning ? "Hide the model's thinking" : "Show the model's thinking"}
            onClick={() => setShowReasoning(!showReasoning)}
          >
            {showReasoning ? <Eye aria-hidden="true" /> : <EyeOff aria-hidden="true" />}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size={compact ? "icon" : "sm"}
          className={cn("shrink-0", compact ? "size-8" : "h-8")}
          onClick={() => setMembersOpen(true)}
          aria-label={isOwner ? "Share chat" : "Chat members"}
        >
          <Users aria-hidden="true" />
          {compact ? null : <span className="hidden sm:inline">{isOwner ? "Share" : "Members"}</span>}
        </Button>
        {closeButton}
      </header>
      <MembersDialog
        chatId={chatId}
        chatTitle={chat.title}
        isOwner={isOwner}
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        onLeft={onClose ?? onBack}
      />

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn("mx-auto w-full max-w-3xl px-4", compact ? "py-3" : "py-6")}>
          {/* AICHAT-168: the stream dropped; the reply is refetched as soon as it is back. */}
          {reconnecting && (
            <div
              role="status"
              aria-label="Reconnecting"
              data-testid="chat-reconnecting"
              className="mb-4 flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
            >
              <WifiOff aria-hidden="true" className="size-4" />
              Reconnecting…
            </div>
          )}
          {messagesQuery.isError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>Could not load messages.</AlertDescription>
            </Alert>
          )}

          <MessageList
            messages={messages}
            currentUserId={userId}
            onStop={(messageId) => stopMessage.mutate({ chatId, messageId })}
            onRetry={(messageId) => retryMessage.mutate({ chatId, messageId, userId, provider: chat.provider })}
            retryingMessageId={retryMessage.isPending ? retryMessage.variables?.messageId : undefined}
            showReasoning={showReasoning}
            compact={compact}
          />

          <MessageQueue chatId={chatId} messages={messages} currentUserId={userId} />
        </div>
      </div>

      <div className="border-t border-border bg-background">
        <div className={cn("mx-auto w-full max-w-3xl px-4", compact ? "py-2" : "py-4")}>
          <Composer chatId={chatId} userId={userId} provider={chat.provider} model={chat.model} compact={compact} />
        </div>
      </div>
    </section>
  );
}
