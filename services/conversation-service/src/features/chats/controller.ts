import type { Request, Response } from "express";
import { principalFrom } from "../../shared/auth-middleware.js";
import { addMemberSchema, createChatSchema, updateChatSchema, chatIdParamsSchema, memberParamsSchema } from "./schema.js";
import type { ChatsService } from "./service.js";

export function createChatsController(service: ChatsService) {
  return {
    async list(req: Request, res: Response) {
      const chats = await service.list(principalFrom(req));
      res.json({ chats });
    },

    async create(req: Request, res: Response) {
      const input = createChatSchema.parse(req.body);
      const chat = await service.create(principalFrom(req), input);
      res.status(201).json({ chat });
    },

    async get(req: Request, res: Response) {
      const { id } = chatIdParamsSchema.parse(req.params);
      const chat = await service.get(principalFrom(req), id);
      res.json({ chat });
    },

    async update(req: Request, res: Response) {
      const { id } = chatIdParamsSchema.parse(req.params);
      const input = updateChatSchema.parse(req.body);
      const chat = await service.update(req.userId, id, input);
      res.json({ chat });
    },

    async remove(req: Request, res: Response) {
      const { id } = chatIdParamsSchema.parse(req.params);
      await service.remove(req.userId, id);
      res.status(204).send();
    },

    async listMembers(req: Request, res: Response) {
      const { id } = chatIdParamsSchema.parse(req.params);
      const members = await service.listMembers(principalFrom(req), id);
      res.json({ members });
    },

    async addMember(req: Request, res: Response) {
      const { id } = chatIdParamsSchema.parse(req.params);
      const { email } = addMemberSchema.parse(req.body);
      const member = await service.addMember(principalFrom(req), id, email);
      res.status(201).json({ member });
    },

    async removeMember(req: Request, res: Response) {
      const { id, email } = memberParamsSchema.parse(req.params);
      await service.removeMember(principalFrom(req), id, email);
      res.status(204).send();
    },

    async leave(req: Request, res: Response) {
      const { id } = chatIdParamsSchema.parse(req.params);
      await service.leave(principalFrom(req), id);
      res.status(204).send();
    },
  };
}
