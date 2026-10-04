/** Seeded pseudo-random generator (mulberry32), so the same SEED always gives the same data. */
export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [min, max], both included. */
  int(min: number, max: number): number;
  /** One item of a non-empty list. */
  pick<T>(items: readonly T[]): T;
  /** True with the given probability (0 to 1). */
  chance(probability: number): boolean;
  /** Back to the first value of the sequence. */
  reset(): void;
}

/** A numeric seed is used as is; any other text is hashed (FNV-1a) to a number. */
export function seedToNumber(seed: string | number): number {
  if (typeof seed === "number") return seed >>> 0;
  if (/^-?\d+$/.test(seed)) return Number(seed) >>> 0;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createRng(seed: string | number): Rng {
  const initial = seedToNumber(seed);
  let state = initial;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (items) => {
      if (items.length === 0) throw new Error("pick() needs a non-empty list");
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    chance: (probability) => next() < probability,
    reset: () => {
      state = initial;
    },
  };
}
