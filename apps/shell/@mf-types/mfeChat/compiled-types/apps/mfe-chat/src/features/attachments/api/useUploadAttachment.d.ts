import type { Attachment } from "../../../shared/types";
/**
 * AC-66: uploads a file attached to a message.
 * AC-67/AC-68: the server re-validates type/size even though the client
 * already checked (`validateAttachmentFile`) — this hook simply surfaces
 * whatever the server rejects with (defense in depth).
 * AC-71: if the server rejects because the chat's model can't handle the
 * attachment type, its error message is surfaced via `ApiError`.
 */
export declare function useUploadAttachment(chatId: string): import("@tanstack/react-query").UseMutationResult<Attachment, Error, File, unknown>;
