import type { Request, Response } from "express";
import { principalFrom } from "../../shared/auth-middleware.js";
import { HttpError } from "../../shared/error-handler.js";
import { attachmentParamsSchema } from "./schema.js";
import type { AttachmentsService } from "./service.js";

export function createAttachmentsController(service: AttachmentsService) {
  return {
    async upload(req: Request, res: Response) {
      const { chatId, messageId } = attachmentParamsSchema.parse(req.params);
      const file = req.file;
      if (!file) {
        throw new HttpError(400, "ATTACHMENT_REQUIRED", "No file was provided");
      }

      const attachment = await service.upload(principalFrom(req), chatId, messageId, {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      });

      res.status(201).json({ attachment });
    },
  };
}
