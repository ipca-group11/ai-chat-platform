import { Router } from "express";
import { asyncHandler } from "../../shared/async-handler.js";
import { createMessagesController } from "./controller.js";
import type { MessagesService } from "./service.js";

/** Mounted at `/chats` (nested resource routes). Access to the parent chat (owner or
 * member) is re-checked on every call by `MessagesService` (AC-45). */
export function createMessagesRouter(service: MessagesService): Router {
  const controller = createMessagesController(service);
  const router = Router();

  router.get("/:chatId/messages", asyncHandler(controller.list));
  router.post("/:chatId/messages", asyncHandler(controller.send));
  router.patch("/:chatId/messages/:messageId", asyncHandler(controller.edit));
  router.delete("/:chatId/messages/:messageId", asyncHandler(controller.cancel));
  router.post("/:chatId/messages/:messageId/retry", asyncHandler(controller.retry));
  router.post("/:chatId/stop", asyncHandler(controller.stop));

  return router;
}
