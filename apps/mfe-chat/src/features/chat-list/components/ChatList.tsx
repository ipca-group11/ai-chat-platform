import { useState } from "react";
import { Alert, AlertDescription, Button, Skeleton } from "@app/ui";
import { Plus } from "lucide-react";
import { useChats, useCreateChat, useDeleteChat, useUpdateChat } from "../api/chats";
import { ChatListItem } from "./ChatListItem";
import { NewChatDialog } from "./NewChatDialog";

export interface ChatListProps {
  activeChatId?: string;
  /** Chats owned by someone else are marked as shared with you. */
  currentUserId?: string;
  /** Chats open in another split-view pane (highlighted, but not the focused one). */
  openChatIds?: string[];
  onOpenChat: (chatId: string) => void;
  /** Opens a chat in an additional split-view pane, right of or below the focused one. */
  onOpenChatInSplit?: (chatId: string, direction: "horizontal" | "vertical") => void;
  /** Called after a chat was deleted, so the page can close it if it is open. */
  onChatDeleted?: (chatId: string) => void;
}

/** AC-42, AC-47: lists only the chats the server returns for the current user (their own
 * plus those shared with them). */
export function ChatList({
  activeChatId,
  currentUserId,
  openChatIds,
  onOpenChat,
  onOpenChatInSplit,
  onChatDeleted,
}: ChatListProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  // Bumped on every open so the dialog starts from a clean form.
  const [dialogKey, setDialogKey] = useState(0);
  const chatsQuery = useChats();
  const createChat = useCreateChat();
  const updateChat = useUpdateChat();
  const deleteChat = useDeleteChat();

  return (
    <nav aria-label="Chats" className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 data-testid="chats-heading" className="text-sm font-semibold tracking-tight">Chats</h2>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setDialogKey((key) => key + 1);
            setDialogOpen(true);
          }}
        >
          <Plus aria-hidden="true" />
          New chat
        </Button>
      </div>
      <NewChatDialog
        key={dialogKey}
        open={dialogOpen}
        submitting={createChat.isPending}
        onClose={() => setDialogOpen(false)}
        onCreate={(input) => {
          createChat.mutate(input, {
            onSuccess: (chat) => {
              setDialogOpen(false);
              onOpenChat(chat.id);
            },
          });
        }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {chatsQuery.isLoading && (
          <div className="space-y-2 p-1">
            <span className="sr-only">Loading chats…</span>
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        )}
        {chatsQuery.isError && (
          <Alert variant="destructive">
            <AlertDescription>Could not load chats.</AlertDescription>
          </Alert>
        )}

        {chatsQuery.data &&
          (chatsQuery.data.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              No chats yet. Create one to get started.
            </p>
          ) : (
            <ul aria-label="Chats" className="space-y-1">
              {chatsQuery.data.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  active={chat.id === activeChatId}
                  open={chat.id !== activeChatId && Boolean(openChatIds?.includes(chat.id))}
                  shared={Boolean(currentUserId) && chat.ownerId !== currentUserId}
                  onOpen={onOpenChat}
                  onOpenInSplit={onOpenChatInSplit}
                  onRename={(chatId, title) => updateChat.mutate({ chatId, title })}
                  onDelete={(chatId) =>
                    deleteChat.mutate(chatId, { onSuccess: () => onChatDeleted?.(chatId) })
                  }
                />
              ))}
            </ul>
          ))}
      </div>
    </nav>
  );
}
