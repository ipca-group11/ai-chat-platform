import type { Request, Response } from "express";

/** Opens a Server-Sent Events response and returns an abort signal that fires when the client leaves. */
export function openEventStream(req: Request, res: Response): AbortSignal {
  const controller = new AbortController();
  res.on("close", () => controller.abort());
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  return controller.signal;
}

/** Writes every frame as soon as it is produced. */
export async function writeFrames(res: Response, frames: AsyncIterable<string>): Promise<void> {
  for await (const frame of frames) {
    if (res.destroyed) return;
    res.write(frame);
  }
}
