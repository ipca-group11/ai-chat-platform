/** AC-58: edit or cancel a queued message before its processing starts. */
export declare function useMessageQueue(chatId: string): {
    editMessage: (messageId: string, content: string) => void;
    cancelMessage: (messageId: string) => void;
    isEditing: boolean;
    isCanceling: boolean;
};
