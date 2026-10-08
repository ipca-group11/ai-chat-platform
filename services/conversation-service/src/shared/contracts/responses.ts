import { z } from "zod";
import { attachmentDtoSchema, chatDtoSchema, chatMemberDtoSchema, messageDtoSchema } from "./chat.js";

/**
 * Response bodies of every JSON route (AICHAT-184). The DTOs live in `./chat.ts`; these are
 * the envelopes the controllers actually send (`res.json({ chat })`, ...). The OpenAPI spec
 * (`src/openapi/document.ts`) and the response validation tests both use them.
 */

export const healthResponseSchema = z.object({ status: z.literal("ok") });

export const chatListResponseSchema = z.object({ chats: z.array(chatDtoSchema) });
export const chatResponseSchema = z.object({ chat: chatDtoSchema });
export const memberListResponseSchema = z.object({ members: z.array(chatMemberDtoSchema) });
export const memberResponseSchema = z.object({ member: chatMemberDtoSchema });

export const messageListResponseSchema = z.object({ messages: z.array(messageDtoSchema) });
export const messageResponseSchema = z.object({ message: messageDtoSchema });
/** `POST /chats/:chatId/stop`: false when no reply was running (not an error). */
export const stopResponseSchema = z.object({ stopped: z.boolean() });

export const attachmentResponseSchema = z.object({ attachment: attachmentDtoSchema });

/** `POST /internal/erasures`: how many rows of each kind were deleted. */
export const erasureResponseSchema = z.object({
  erased: z.object({
    chats: z.number().int().nonnegative(),
    memberships: z.number().int().nonnegative(),
    messages: z.number().int().nonnegative(),
    files: z.number().int().nonnegative(),
  }),
});

/** `POST /internal/sessions/:userId/stop`: how many replies were stopped. */
export const sessionStopResponseSchema = z.object({ stopped: z.number().int().nonnegative() });
