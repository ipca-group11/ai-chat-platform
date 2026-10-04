import { lazy } from "react";

/**
 * The chat view (messages, Markdown rendering, composer, attachments) as a lazy component (AICHAT-239). /chats shows
 * only the list, so it does not download this code; /chats/:id starts the download as soon as this remote's routes
 * module is evaluated (see `routes.tsx`), in parallel with the session check, so opening a chat does not wait for it.
 */
export const loadChatView = () => import("../features/chat-view");

export const ChatView = lazy(() => loadChatView().then((m) => ({ default: m.ChatView })));
