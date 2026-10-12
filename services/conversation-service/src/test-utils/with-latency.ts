/** A small seeded random generator (mulberry32): the same seed gives the same sequence, so
 * a run that fails can be repeated with exactly the same delays. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Wraps the named async methods of a repository so each call waits `delay()` ms before and
 * after it runs, like a round trip to a real database. In-memory fakes answer at once, which
 * hides races that need another request to run in the gap between a read and a write.
 */
export function withLatency<T extends object>(target: T, methods: ReadonlyArray<keyof T>, delay: () => number): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver) as unknown;
      if (typeof value !== "function" || !methods.includes(prop as keyof T)) return value;
      return async (...args: unknown[]) => {
        await sleep(delay());
        const result = (await (value as (...a: unknown[]) => unknown).apply(obj, args)) as unknown;
        await sleep(delay());
        return result;
      };
    },
  });
}
