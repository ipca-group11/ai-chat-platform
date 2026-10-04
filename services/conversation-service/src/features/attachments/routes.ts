import { Router, type RequestHandler } from "express";
import multer from "multer";
import { asyncHandler } from "../../shared/async-handler.js";
import { HttpError } from "../../shared/error-handler.js";
import { createAttachmentsController } from "./controller.js";
import type { AttachmentsService } from "./service.js";

/** Mounted at `/chats`. Uses in-memory multer storage — the service validates the file
 * (AC-67/68) before anything is written to `UPLOAD_DIR`. Multer stops reading at the
 * configured limit (default 10 MB, AC-68) and accepts one file and a few small fields, so
 * a request never holds more than one file of `maxBytes` in memory (AICHAT-254). */
export function createAttachmentsRouter(service: AttachmentsService, maxBytes: number): Router {
  const controller = createAttachmentsController(service);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1, fields: 10, fieldSize: 64 * 1024, parts: 11, headerPairs: 100 },
  }).single("file");
  const limitMb = Math.floor(maxBytes / (1024 * 1024));
  // Keeps the clear per-limit message of AC-68 when multer is the one that stops the file.
  const receiveFile: RequestHandler = (req, res, next) => {
    upload(req, res, (err?: unknown) => {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        next(new HttpError(413, "ATTACHMENT_TOO_LARGE", `The file exceeds the ${limitMb} MB size limit`));
        return;
      }
      next(err);
    });
  };
  const router = Router();

  router.post("/:chatId/messages/:messageId/attachments", receiveFile, asyncHandler(controller.upload));
  // The web client uploads while the message is being written, then sends it with
  // `attachmentIds` (AICHAT-245).
  router.post("/:chatId/attachments", receiveFile, asyncHandler(controller.upload));

  return router;
}
