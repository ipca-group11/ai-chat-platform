/**
 * Chat layout: the chat list as a sidebar and the open chats beside it. Several chats
 * can be open at once as split panes, each opened to the right of or below the focused
 * one, so side-by-side and stacked groups can be mixed. The chat in the URL is the
 * focused pane: opening a chat from the list swaps it into that pane. On small screens
 * only one pane (the list or the focused chat) shows at a time.
 */
export declare function ChatWorkspace({ chatId }: {
    chatId?: string;
}): import("react").JSX.Element;
