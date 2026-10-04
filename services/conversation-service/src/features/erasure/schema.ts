import { z } from "zod";

export const eraseUserSchema = z.object({
  userId: z.string().min(1).max(128),
  email: z.string().email().max(320),
});
