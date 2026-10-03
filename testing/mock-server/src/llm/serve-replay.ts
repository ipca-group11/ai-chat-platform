import type { Request, Response } from "express";
import type { MockContext } from "../registry.js";
import { readFixture, replayFrames } from "./replay.js";
import type { LlmProvider } from "./scenarios.js";
import { openEventStream } from "./sse.js";

/** Answers a `replay:<fixture>` request with the recorded stream, or a clear 404 when the fixture does not exist. */
export async function serveReplay(
  provider: LlmProvider,
  scenario: string,
  ctx: Pick<MockContext, "config">,
  req: Request,
  res: Response,
): Promise<void> {
  const lookup = await readFixture(ctx.config, provider, scenario);
  if (!lookup.found) {
    const list = lookup.available.length > 0 ? lookup.available.join(", ") : "none";
    const message = `Replay fixture "${lookup.name}" not found for ${provider}. Available: ${list}`;
    res
      .status(404)
      .json(
        provider === "anthropic"
          ? { type: "error", error: { type: "not_found_error", message } }
          : { error: { message, type: "invalid_request_error", param: null, code: "fixture_not_found" } },
      );
    return;
  }
  const signal = openEventStream(req, res);
  for await (const frame of replayFrames(lookup.bytes, ctx.config, signal)) {
    if (res.destroyed) return;
    res.write(frame);
  }
  res.end();
}
