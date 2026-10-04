import type { AttachmentKind, Provider } from "../../../shared/types";
/**
 * Best-effort, client-side model capability lookup used to warn the user
 * *before* sending (AC-71). The rules live in `packages/shared-types` (AICHAT-133) and are
 * the same ones `conversation-service` applies, so a model accepted here is accepted by
 * the server. The server's error response is still surfaced if it ever refuses
 * (see `useUploadAttachment`).
 */
export declare function supportsAttachmentKind(provider: Provider, model: string, kind: AttachmentKind): boolean;
