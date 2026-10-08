import type { CSSProperties } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Button, cn } from "@app/ui";
import { Columns2, MessageSquare, Rows2 } from "lucide-react";
import { ChatList } from "../features/chat-list";
import { ChatView } from "../features/chat-view";
import { useCurrentUserId } from "./auth-context";
import {
  closePane,
  focusedOrientation,
  openInFocusedPane,
  openInNewPane,
  paneIds,
  paneRects,
  setFocusedOrientation,
  useSplitLayout,
  visibleLayout,
  type SplitOrientation,
} from "./split-panes";
import { useMediaQuery } from "./use-media-query";

/**
 * Chat layout: the chat list as a sidebar and the open chats beside it. Several chats
 * can be open at once as split panes, each opened to the right of or below the focused
 * one, so side-by-side and stacked groups can be mixed. The chat in the URL is the
 * focused pane: opening a chat from the list swaps it into that pane. On small screens
 * only one pane (the list or the focused chat) shows at a time.
 */
export function ChatWorkspace({ chatId }: { chatId?: string }) {
  const navigate = useNavigate();
  const userId = useCurrentUserId();
  const [layout, setLayout] = useSplitLayout();
  const root = visibleLayout(layout.root, chatId);
  const panes = paneIds(root);
  const split = panes.length > 1;
  const orientation = focusedOrientation(root, chatId);
  // Tailwind's `md` breakpoint: below it only the focused pane shows, filling the workspace.
  const wide = useMediaQuery("(min-width: 768px)");

  const focusChat = (id: string | undefined, replace = false) => {
    if (id) void navigate({ to: "/chats/$chatId", params: { chatId: id }, replace });
    else void navigate({ to: "/chats" });
  };

  const openChat = (id: string) => {
    setLayout((prev) => ({ ...prev, root: openInFocusedPane(prev.root, chatId, id) }));
    focusChat(id);
  };
  const openChatInSplit = (id: string, direction: SplitOrientation) => {
    setLayout((prev) => ({ ...prev, root: openInNewPane(prev.root, chatId, id, direction) }));
    focusChat(id);
  };
  const closeChat = (id: string) => {
    const next = closePane(layout.root, chatId, id);
    setLayout((prev) => ({ ...prev, root: next.root }));
    if (next.focus !== chatId) focusChat(next.focus);
  };
  /** Interacting with a pane focuses it, except its close button (closing must not move focus there first). */
  const focusPane = (id: string, target: EventTarget) => {
    if (id === chatId) return;
    if (target instanceof Element && target.closest("[data-pane-close]")) return;
    focusChat(id, true);
  };
  /** Flips the group holding the focused pane; other groups keep their own orientation. */
  const setOrientation = (next: SplitOrientation) => {
    setLayout((prev) => ({ ...prev, root: setFocusedOrientation(visibleLayout(prev.root, chatId), chatId, next) }));
  };
  const backToList = () => {
    void navigate({ to: "/chats" });
  };

  return (
    <div className="flex h-[calc(100svh-3.5rem-1px)] min-h-0 w-full">
      <aside
        className={cn(
          "w-full shrink-0 flex-col border-r border-border bg-muted/30 md:flex md:w-72",
          chatId ? "hidden" : "flex"
        )}
      >
        <ChatList
          activeChatId={chatId}
          currentUserId={userId}
          openChatIds={panes}
          onOpenChat={openChat}
          onOpenChatInSplit={chatId ? openChatInSplit : undefined}
          onChatDeleted={(id) => {
            if (panes.includes(id)) closeChat(id);
          }}
        />
      </aside>

      <div className={cn("min-w-0 flex-1 flex-col", chatId ? "flex" : "hidden md:flex")}>
        {split ? (
          <div className="hidden items-center justify-end gap-1 border-b border-border bg-muted/30 px-2 py-1 md:flex">
            <span className="mr-auto px-2 text-xs text-muted-foreground">{panes.length} chats open</span>
            <div role="group" aria-label="Layout of the focused chat's group" className="flex gap-1">
              <Button
                type="button"
                variant={orientation === "horizontal" ? "secondary" : "ghost"}
                size="icon"
                className="size-7"
                aria-label="Side by side"
                aria-pressed={orientation === "horizontal"}
                onClick={() => setOrientation("horizontal")}
              >
                <Columns2 aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant={orientation === "vertical" ? "secondary" : "ghost"}
                size="icon"
                className="size-7"
                aria-label="Stacked"
                aria-pressed={orientation === "vertical"}
                onClick={() => setOrientation("vertical")}
              >
                <Rows2 aria-hidden="true" />
              </Button>
            </div>
          </div>
        ) : null}

        {panes.length > 0 ? (
          // Panes are absolutely positioned from the layout tree (rather than nested flex
          // boxes) so splitting or rearranging never remounts a chat and loses its draft.
          <div className="relative min-h-0 flex-1">
            {paneRects(root).map((rect) => {
              const id = rect.chatId;
              const focused = id === chatId;
              // Inline rather than utility classes: positions are computed, and the shared
              // stylesheet only contains classes that existed when @app/ui was built.
              const style: CSSProperties | undefined = wide
                ? {
                    top: `${rect.top}%`,
                    left: `${rect.left}%`,
                    width: `${rect.width}%`,
                    height: `${rect.height}%`,
                    borderLeftWidth: rect.left > 0.01 ? 1 : 0,
                    borderTopWidth: rect.top > 0.01 ? 1 : 0,
                  }
                : undefined;
              return (
                <div
                  key={id}
                  data-testid={`chat-pane-${id}`}
                  data-focused={split && focused ? "true" : undefined}
                  style={style}
                  className={cn(
                    "absolute inset-0 min-h-0 min-w-0 flex-col border-border",
                    focused ? "flex" : "hidden md:flex"
                  )}
                  onPointerDownCapture={(e) => focusPane(id, e.target)}
                  onFocusCapture={(e) => focusPane(id, e.target)}
                >
                  {split && focused ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-10 hidden ring-2 ring-inset ring-ring/40 md:block"
                    />
                  ) : null}
                  <ChatView
                    chatId={id}
                    userId={userId}
                    onBack={backToList}
                    onClose={split ? () => closeChat(id) : undefined}
                    compact={split}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted">
              <MessageSquare className="size-5 text-muted-foreground" aria-hidden="true" />
            </span>
            <h2 data-testid="select-chat-heading" className="text-lg font-semibold tracking-tight">Select a chat</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Pick a conversation from the list, or start a new one to begin chatting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
