import type { Request, Response } from "express";
import { principalFrom } from "../../shared/auth-middleware.js";
import { LLM_API_KEY_HEADER } from "../../shared/contracts/http.js";
import { chatParamsSchema, editMessageSchema, messageParamsSchema, sendMessageSchema } from "./schema.js";
import type { MessagesService } from "./service.js";

function apiKeyFrom(req: Request): string | undefined {
  const header = req.header(LLM_API_KEY_HEADER);
  return header && header.length > 0 ? header : undefined;
}

export function createMessagesController(service: MessagesService) {
  return {
    async list(req: Request, res: Response) {
      const { chatId } = chatParamsSchema.parse(req.params);
      const messages = await service.list(principalFrom(req), chatId);
      res.json({ messages });
    },

    async send(req: Request, res: Response) {
      const { chatId } = chatParamsSchema.parse(req.params);
      const input = sendMessageSchema.parse(req.body);
      const message = await service.send(principalFrom(req), chatId, input, apiKeyFrom(req));
      res.status(201).json({ message });
    },

    async edit(req: Request, res: Response) {
      const { chatId, messageId } = messageParamsSchema.parse(req.params);
      const { content } = editMessageSchema.parse(req.body);
      const message = await service.editQueued(principalFrom(req), chatId, messageId, content);
      res.json({ message });
    },

    async cancel(req: Request, res: Response) {
      const { chatId, messageId } = messageParamsSchema.parse(req.params);
      await service.cancelQueued(principalFrom(req), chatId, messageId);
      res.status(204).send();
    },

    async stop(req: Request, res: Response) {
      const { chatId } = chatParamsSchema.parse(req.params);
      const result = await service.stop(principalFrom(req), chatId);
      res.json(result);
    },

    async retry(req: Request, res: Response) {
      const { chatId, messageId } = messageParamsSchema.parse(req.params);
      const message = await service.retry(principalFrom(req), chatId, messageId, apiKeyFrom(req));
      res.status(202).json({ message });
    },
  };
}
