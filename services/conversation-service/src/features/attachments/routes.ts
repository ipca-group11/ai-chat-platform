import { Router, type RequestHandler } from "express";
import multer, { MulterError } from "multer";
import { asyncHandler } from "../../shared/async-handler.js";
import { HttpError } from "../../shared/error-handler.js";
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

  router.post("/:chatId/messages/:messageId/attachments", readFile(upload.single("file")), asyncHandler(controller.upload));

  return router;
}

/** A multipart body the parser cannot read (a part without headers, a cut-off form) is the client's
 * mistake: answer 400, not 500. Found by Schemathesis (AICHAT-187). Multer's own errors (size
 * ceiling, unexpected field) keep their specific handling in the error handler. */
function readFile(parse: RequestHandler): RequestHandler {
  return (req, res, next) => {
    parse(req, res, (err?: unknown) => {
      if (err === undefined || err === null || err instanceof MulterError) {
        next(err);
        return;
      }
      next(new HttpError(400, "ATTACHMENT_UPLOAD_ERROR", "The upload could not be read"));
    });
  };
}
