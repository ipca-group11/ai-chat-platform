import { useState } from "react";
import { Button, Input, cn } from "@app/ui";
import { PanelBottom, PanelRight, Pencil, Trash2, Users } from "lucide-react";
import type { Chat } from "../../../shared/types";

export interface ChatListItemProps {
  chat: Chat;
  active?: boolean;
  /** Open in another split-view pane (the focused one is `active`). */
  open?: boolean;
  /** The chat was shared with the current user: they can open it, but not rename or delete it. */
  shared?: boolean;
  onOpen: (chatId: string) => void;
  /**
   * Opens the chat in an additional split-view pane, right of (`horizontal`) or below
   * (`vertical`) the focused one; shows the split buttons when provided.
   */
  onOpenInSplit?: (chatId: string, direction: "horizontal" | "vertical") => void;
  onRename: (chatId: string, title: string) => void;
  onDelete: (chatId: string) => void;
}

/** AC-42: open, rename, delete a chat from the list. */
export function ChatListItem({
  chat,
  active,
  open = false,
  shared = false,
  onOpen,
  onOpenInSplit,
  onRename,
  onDelete,
}: ChatListItemProps) {
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(chat.title);

  if (renaming) {
    return (
      <li data-testid={`chat-item-${chat.id}`}>
        <form
          className="flex items-center gap-1 rounded-md bg-background p-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) onRename(chat.id, title.trim());
            setRenaming(false);
          }}
        >
          <Input
            aria-label={`Rename ${chat.title}`}
            data-testid="rename-title"
            autoFocus
            className="h-8"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Button type="submit" size="sm" className="h-8" data-testid="save-rename">
            Save
          </Button>
          <Button type="button" size="sm" variant="ghost" className="h-8" data-testid="cancel-rename" onClick={() => setRenaming(false)}>
            Cancel
          </Button>
        </form>
      </li>
    );
  }

  return (
    <li
      data-testid={`chat-item-${chat.id}`}
      aria-current={active ? "true" : undefined}
      className={cn(
        "group relative flex items-center gap-0.5 rounded-md pr-1 transition-colors hover:bg-accent",
        active && "bg-accent text-accent-foreground",
        open && "bg-accent/50"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        className="h-auto min-w-0 flex-1 flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-transparent"
        data-testid="open-chat"
        onClick={() => onOpen(chat.id)}
      >
        <span className="flex w-full items-center gap-1.5">
          <span data-testid="chat-item-title" className="truncate text-sm font-medium">{chat.title}</span>
          {shared ? (
            <Users className="size-3.5 shrink-0 text-muted-foreground" aria-label="Shared with you" />
          ) : null}
        </span>
        <span data-testid="chat-item-model" className="w-full truncate text-xs font-normal text-muted-foreground">
          {shared && chat.ownerEmail ? `${chat.ownerEmail} · ` : null}
          {chat.provider} · {chat.model}
        </span>
      </Button>
      {/* On touch screens the actions stay visible in the row; with a mouse they overlay the
          row's end on hover/focus, so hidden buttons don't truncate the title and model. */}
      <span
        className={cn(
          "flex shrink-0 items-center gap-0.5 rounded-md",
          "[@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:absolute [@media(hover:hover)]:right-1",
          "[@media(hover:hover)]:top-1/2 [@media(hover:hover)]:-translate-y-1/2 [@media(hover:hover)]:bg-accent",
          "[@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:pointer-events-auto",
          "[@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:pointer-events-auto",
          "[@media(hover:hover)]:group-focus-within:opacity-100"
        )}
      >
        {onOpenInSplit && !active && !open ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden size-8 shrink-0 text-muted-foreground md:inline-flex"
              onClick={() => onOpenInSplit(chat.id, "horizontal")}
              aria-label={`Open ${chat.title} to the right`}
            >
              <PanelRight aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hidden size-8 shrink-0 text-muted-foreground md:inline-flex"
              onClick={() => onOpenInSplit(chat.id, "vertical")}
              aria-label={`Open ${chat.title} below`}
            >
              <PanelBottom aria-hidden="true" />
            </Button>
          </>
        ) : null}
        {shared ? null : (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground"
              data-testid="rename-chat"
              onClick={() => setRenaming(true)}
              aria-label={`Rename ${chat.title}`}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
              data-testid="delete-chat"
              onClick={() => onDelete(chat.id)}
              aria-label={`Delete ${chat.title}`}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </>
        )}
      </span>
    </li>
  );
}
