import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { principalFrom } from "../../shared/auth-middleware.js";
import type { ChatsService } from "../chats/index.js";
import { initSseResponse, writeSseEvent, type ChatEventBus } from "./sse.js";

const paramsSchema = z.object({ chatId: z.string().min(1) });

/** `GET /chats/:chatId/stream` — Server-Sent Events for the given chat (ARCHITECTURE.md
 * §5). Access (owner or member) is checked before opening the stream (AC-45/46). Multiple chats stream
 * independently: each connection only ever receives events for its own `chatId`
 * (AC-60/61). */
export function createStreamingRouter(chatsService: ChatsService, bus: ChatEventBus): Router {
  const router = Router();

  router.get(
    "/:chatId/stream",
    asyncHandler(async (req, res) => {
      const { chatId } = paramsSchema.parse(req.params);
      await chatsService.getAccessible(principalFrom(req), chatId);

      initSseResponse(res);
      const unsubscribe = bus.subscribe(chatId, (event) => writeSseEvent(res, event));

      req.on("close", () => {
        unsubscribe();
      });
    }),
  );

  return router;
}
