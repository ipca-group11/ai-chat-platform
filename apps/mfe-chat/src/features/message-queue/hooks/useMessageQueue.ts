import { useCancelQueuedMessage, useEditQueuedMessage } from "../../chat-view";

/** AC-58: edit or cancel a queued message before its processing starts. */
export function useMessageQueue(chatId: string) {
  const editQueued = useEditQueuedMessage();
  const cancelQueued = useCancelQueuedMessage();

  return {
    editMessage: (messageId: string, content: string) => editQueued.mutate({ chatId, messageId, content }),
    cancelMessage: (messageId: string) => cancelQueued.mutate({ chatId, messageId }),
    isEditing: editQueued.isPending,
    isCanceling: cancelQueued.isPending,
  };
}
