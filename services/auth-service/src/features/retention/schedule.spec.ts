import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { scheduleRetention } from "./schedule.js";

describe("scheduleRetention", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("runs once right away and then every interval until stopped", async () => {
    const job = vi.fn().mockResolvedValue(undefined);
    const stop = scheduleRetention(job, 1000, vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    expect(job).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(3000);
    expect(job).toHaveBeenCalledTimes(4);

    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(job).toHaveBeenCalledTimes(4);
  });

  it("reports a failed run and still runs the next one", async () => {
    const job = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
    const onError = vi.fn();
    const stop = scheduleRetention(job, 1000, onError);

    await vi.advanceTimersByTimeAsync(1000);

    expect(onError).toHaveBeenCalledTimes(1);
    expect(job).toHaveBeenCalledTimes(2);
    stop();
  });

  it("never lets two runs overlap", async () => {
    let release: () => void = () => {};
    const job = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const stop = scheduleRetention(job, 1000, vi.fn());

    await vi.advanceTimersByTimeAsync(3500);
    expect(job).toHaveBeenCalledTimes(1); // still running, the later ticks were skipped

    release();
    await vi.advanceTimersByTimeAsync(1000);
    expect(job).toHaveBeenCalledTimes(2);
    stop();
  });
});
