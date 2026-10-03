import { useParams } from "@tanstack/react-router";
import { ChatWorkspace } from "./ChatWorkspace";

/** Page for the `/chats/:chatId` route registered by this remote (FE-1). */
export function ChatDetailPage() {
  const { chatId } = useParams({ strict: false });
  return <ChatWorkspace chatId={chatId} />;
}
