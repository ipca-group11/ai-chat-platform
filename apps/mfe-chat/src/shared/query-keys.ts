/** Central TanStack Query key factory, shared by every feature in this app. */
export const queryKeys = {
  chats: () => ["chats"] as const,
  chat: (chatId: string) => ["chats", chatId] as const,
  messages: (chatId: string) => ["chats", chatId, "messages"] as const,
  members: (chatId: string) => ["chats", chatId, "members"] as const,
};
