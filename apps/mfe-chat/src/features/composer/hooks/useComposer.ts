import { useState } from "react";
import { useSendMessage } from "../../chat-view";
import { usePendingAttachments } from "../../attachments";
import type { Provider } from "../../../shared/types";

export interface UseComposerArgs {
  chatId: string;
  userId: string;
  provider: Provider;
  model: string;
}

/**
 * Composer state/behavior: text content, staged attachments, and sending.
 * AC-51: sends the text message (persisted immediately server-side).
 * AC-66: attachments staged here are included by id when the message is sent.
 */
export function useComposer({ chatId, userId, provider, model }: UseComposerArgs) {
  const [content, setContent] = useState("");
  const sendMessage = useSendMessage();
  const attachments = usePendingAttachments(chatId, provider, model);

  const hasRejectedAttachments = attachments.pending.some((p) => p.status === "rejected");
  const canSend =
    (content.trim().length > 0 || attachments.uploadedAttachmentIds.length > 0) &&
    !attachments.hasBlockingUploads &&
    !hasRejectedAttachments &&
    !sendMessage.isPending;

  function send() {
    if (!canSend) return;
    sendMessage.mutate(
      { chatId, content: content.trim(), attachmentIds: attachments.uploadedAttachmentIds, userId, provider },
      {
        onSuccess: () => {
          setContent("");
          attachments.clear();
        },
      }
    );
  }

  return {
    content,
    setContent,
    send,
    canSend,
    isSending: sendMessage.isPending,
    sendError: sendMessage.error,
    attachments,
  };
}
