import { createRng } from "../prng.js";

const WORDS = [
  "the", "mock", "server", "answers", "with", "a", "steady", "stream", "of", "small", "words", "so", "that",
  "chat", "can", "show", "text", "as", "it", "arrives", "and", "tests", "stay", "repeatable", "from",
  "one", "run", "to", "next", "when", "seed", "does", "not", "change", "every", "token",
  "is", "picked", "by", "seeded", "generator",
] as const;

/**
 * `count` text tokens (a word and its trailing space each). The text depends only on the
 * seed and the key, never on how many requests came before, so the same SEED always gives
 * the same answer.
 */
export function generateTokens(seed: string, key: string, count: number): string[] {
  const rng = createRng(`${seed}/${key}`);
  const tokens: string[] = [];
  for (let i = 0; i < count; i++) {
    const word = rng.pick(WORDS);
    const text = i === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word;
    tokens.push(i === count - 1 ? `${text}.` : `${text} `);
  }
  return tokens;
}
