import { z } from "zod";

export const attachmentParamsSchema = z.object({
  chatId: z.string().min(1),
  messageId: z.string().min(1),
});
