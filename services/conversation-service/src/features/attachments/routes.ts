import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../../shared/async-handler.js";
import { createAttachmentsController } from "./controller.js";
import type { AttachmentsService } from "./service.js";

/** Mounted at `/chats`. Uses in-memory multer storage — the service validates the file
 * (AC-67/68) before anything is written to `UPLOAD_DIR`. A generous hard ceiling
 * (`maxBytesCeiling`) guards against unbounded request bodies; the actual configured
 * limit (default 10 MB, AC-68) is enforced by `AttachmentsService.upload` with a clear
 * per-file error message. */
export function createAttachmentsRouter(service: AttachmentsService, maxBytesCeiling: number): Router {
  const controller = createAttachmentsController(service);
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytesCeiling } });
  const router = Router();

  router.post("/:chatId/messages/:messageId/attachments", upload.single("file"), asyncHandler(controller.upload));
  // The web client uploads while the message is being written, then sends it with
  // `attachmentIds` (AICHAT-245).
  router.post("/:chatId/attachments", upload.single("file"), asyncHandler(controller.upload));

  return router;
}
