/** Central TanStack Query key factory, shared by every feature in this app. */
export declare const queryKeys: {
    chats: () => readonly ["chats"];
    chat: (chatId: string) => readonly ["chats", string];
    messages: (chatId: string) => readonly ["chats", string, "messages"];
    members: (chatId: string) => readonly ["chats", string, "members"];
};
