import { EventEmitter } from "node:events";
import type { Response } from "express";
import type { SseEvent } from "../../shared/contracts/chat.js";

/**
 * Process-local pub/sub hub, one logical channel per chatId (ARCHITECTURE.md §5). The
 * queue/messages processor publishes `token`/`started`/`queued`/`done`/`error` events;
 * any number of `GET /chats/:id/stream` connections for that chat receive every event,
 * so switching chats in the UI never interrupts another chat's in-progress stream
 * (AC-60/61).
 */
export class ChatEventBus {
  private readonly emitters = new Map<string, EventEmitter>();

  private getEmitter(chatId: string): EventEmitter {
    let emitter = this.emitters.get(chatId);
    if (!emitter) {
      emitter = new EventEmitter();
      emitter.setMaxListeners(0);
      this.emitters.set(chatId, emitter);
    }
    return emitter;
  }

  publish(chatId: string, event: SseEvent): void {
    this.getEmitter(chatId).emit("event", event);
  }

  /** How many connections listen to the chat (AICHAT-169: a closed stream must not stay subscribed). */
  subscriberCount(chatId: string): number {
    return this.emitters.get(chatId)?.listenerCount("event") ?? 0;
  }

  /** Returns an unsubscribe function. */
  subscribe(chatId: string, listener: (event: SseEvent) => void): () => void {
    const emitter = this.getEmitter(chatId);
    emitter.on("event", listener);
    return () => emitter.off("event", listener);
  }
}

export function initSseResponse(res: Response): void {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

export function writeSseEvent(res: Response, event: SseEvent): void {
  res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

/** A comment line (`: text`): EventSource ignores it, but bytes keep flowing (AICHAT-169 heartbeat). */
export function writeSseComment(res: Response, text: string): void {
  res.write(`: ${text}\n\n`);
}
