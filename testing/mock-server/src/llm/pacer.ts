import type { MockConfig } from "../config.js";
import { sleep } from "../middleware.js";

/** Waits TTFT_MS before the first token and TOKEN_INTERVAL_MS before each later one. */
export class Pacer {
  private first = true;

  constructor(
    private readonly config: Pick<MockConfig, "ttftMs" | "tokenIntervalMs">,
    private readonly extraFirstDelayMs = 0,
  ) {}

  async next(): Promise<void> {
    const wait = this.first ? this.config.ttftMs + this.extraFirstDelayMs : this.config.tokenIntervalMs;
    this.first = false;
    if (wait > 0) await sleep(wait);
  }
}
