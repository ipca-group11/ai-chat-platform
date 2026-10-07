import { Router } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import { eraseUserSchema } from "./schema.js";
import type { ErasureService } from "./service.js";
import { requireServiceToken } from "../../shared/service-token.js";

/** Mounted at `/internal`, before the user authentication. Called by auth-service only,
 * with the service token (no user session exists at that point of the account deletion). */
export function createErasureRouter(service: ErasureService, serviceToken: string): Router {
  const router = Router();
  router.use(requireServiceToken(serviceToken));

  router.post(
    "/erasures",
    asyncHandler(async (req, res) => {
      const { userId, email } = eraseUserSchema.parse(req.body);
      const summary = await service.eraseUser(userId, email);
      res.status(200).json({ erased: summary });
    }),
  );

  return router;
}
