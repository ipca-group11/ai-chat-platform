import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { requireServiceToken } from "../../shared/service-token.js";
import type { MessagesService } from "./service.js";

export const sessionParamsSchema = z.object({ userId: z.string().min(1) });

/** Mounted at `/internal`, before the user authentication. auth-service calls it with the
 * service token when the user logs out (AICHAT-203): every reply the user started stops, and
 * its partial text is saved as for a Stop click. Repeating the call is safe. */
export function createInternalSessionsRouter(service: MessagesService, serviceToken: string): Router {
  const router = Router();
  router.use(requireServiceToken(serviceToken));

  router.post(
    "/sessions/:userId/stop",
    asyncHandler(async (req, res) => {
      const { userId } = sessionParamsSchema.parse(req.params);
      res.status(200).json(service.stopAllForUser(userId));
    }),
  );

  return router;
}
