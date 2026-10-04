/** Runs `job` every `intervalMs` (and once right away) until the returned function is called. A run that
 * fails is reported to `onError` and the next one still happens; runs never overlap. */
export function scheduleRetention(job: () => Promise<void>, intervalMs: number, onError: (error: unknown) => void): () => void {
  let running = false;
  const tick = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      await job();
    } catch (error) {
      onError(error);
    } finally {
      running = false;
    }
  };
  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref(); // never keeps the process alive on its own
  return () => clearInterval(timer);
}
