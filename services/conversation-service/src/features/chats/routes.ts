import { Router } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import type { ChatsService } from "./service.js";
import { createChatsController } from "./controller.js";

/** All routes assume `authMiddleware` has already run and set `req.userId`/`req.userEmail`
 * (AC-45: reads are checked against ownership or membership; update/delete and adding
 * members against ownership only). */
export function createChatsRouter(service: ChatsService): Router {
  const controller = createChatsController(service);
  const router = Router();

  router.get("/", asyncHandler(controller.list));
  router.post("/", asyncHandler(controller.create));
  router.get("/:id", asyncHandler(controller.get));
  router.patch("/:id", asyncHandler(controller.update));
  router.delete("/:id", asyncHandler(controller.remove));
  router.get("/:id/members", asyncHandler(controller.listMembers));
  router.post("/:id/members", asyncHandler(controller.addMember));
  router.delete("/:id/members/:email", asyncHandler(controller.removeMember));
  router.delete("/:id/membership", asyncHandler(controller.leave));

  return router;
}
