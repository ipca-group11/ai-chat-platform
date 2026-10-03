import { useMutation } from "@tanstack/react-query";
import { apiClient } from "../../../shared/api-client";
import type { Attachment } from "../../../shared/types";

/**
 * AC-66: uploads a file attached to a message.
 * AC-67/AC-68: the server re-validates type/size even though the client
 * already checked (`validateAttachmentFile`) — this hook simply surfaces
 * whatever the server rejects with (defense in depth).
 * AC-71: if the server rejects because the chat's model can't handle the
 * attachment type, its error message is surfaced via `ApiError`.
 */
export function useUploadAttachment(chatId: string) {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      return apiClient.post<Attachment>(`/chats/${chatId}/attachments`, formData);
    },
  });
}
