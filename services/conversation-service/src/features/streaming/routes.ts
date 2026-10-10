import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../shared/async-handler.js";
import { principalFrom } from "../../shared/auth-middleware.js";
import type { StreamCounter } from "../../shared/metrics.js";
import type { ChatsService } from "../chats/index.js";
import { initSseResponse, writeSseComment, writeSseEvent, type ChatEventBus } from "./sse.js";

const paramsSchema = z.object({ chatId: z.string().min(1) });

/** AICHAT-167: an idle stream (slow model, long queue) writes a comment this often, so a proxy or
 * load balancer idle timeout (Caddy, Azure ~4 min) does not cut it. */
export const HEARTBEAT_INTERVAL_MS = 15_000;

/** `GET /chats/:chatId/stream` — Server-Sent Events for the given chat (ARCHITECTURE.md
 * §5). Access (owner or member) is checked before opening the stream (AC-45/46). Multiple chats stream
 * independently: each connection only ever receives events for its own `chatId`
 * (AC-60/61). `openStreams` tracks how many connections are open (the `active_streams`
 * metric). A `: ping` comment is written every `HEARTBEAT_INTERVAL_MS` while the stream is open. */
export function createStreamingRouter(
  chatsService: ChatsService,
  bus: ChatEventBus,
  openStreams?: StreamCounter,
): Router {
  const router = Router();

  router.get(
    "/:chatId/stream",
    asyncHandler(async (req, res) => {
      const { chatId } = paramsSchema.parse(req.params);
      await chatsService.getAccessible(principalFrom(req), chatId);

      initSseResponse(res);
      const unsubscribe = bus.subscribe(chatId, (event) => writeSseEvent(res, event));
      openStreams?.inc();
      const heartbeat = setInterval(() => writeSseComment(res, "ping"), HEARTBEAT_INTERVAL_MS);

      req.on("close", () => {
        clearInterval(heartbeat);
        unsubscribe();
        openStreams?.dec();
      });
    }),
  );

  return router;
}
