import type { Attack } from "./attacks.ts";
import { promptFor } from "./attacks.ts";
import { TEST_SYSTEM_PROMPT } from "./canary.ts";

/** Hard cap of one run, in US dollars (README of the epic, section 1). A lower `REDTEAM_BUDGET_USD` is allowed. */
export const MAX_BUDGET_USD = 2;

/** List prices in USD per million tokens. Only models the red team may use are listed; others are refused. */
export const PRICES: Readonly<Record<string, { input: number; output: number }>> = {
  "claude-haiku-4-5": { input: 1, output: 5 },
};

/** Assumptions behind the estimate. Deliberately on the high side: a typical answer is shorter. */
export const ASSUMPTIONS = {
  /** A page the model fetches (tokens that come back as input). A real page is capped at 25000 by the app. */
  fetchedPageTokens: 10_000,
  pagesFetchedPerAttack: 2,
  /** A 900x260 image costs about 320 tokens; round up. */
  imageTokens: 600,
  /** A PDF page or a text file. */
  fileTokens: 800,
  answerTokens: 1_500,
  /** The `llm-rubric` grader reads the answer and the rubric and replies with a short JSON. */
  graderInputTokens: 1_200,
  graderOutputTokens: 150,
} as const;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function priceOf(model: string): { input: number; output: number } {
  const known = PRICES[model];
  if (!known) throw new Error(`no price for model "${model}" (known: ${Object.keys(PRICES).join(", ")})`);
  return known;
}

/** Model name without the mock scenario suffix (`claude-haiku-4-5@inject-obey`). */
export const baseModel = (model: string): string => model.split("@")[0] ?? model;

function usd(model: string, inputTokens: number, outputTokens: number): number {
  const price = priceOf(baseModel(model));
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}

/** Estimated cost of playing one attack once: the answer, the grader, and the file or pages it brings in. */
export function estimateAttackUsd(attack: Attack, model: string, pagesBaseUrl = "http://attack-pages"): number {
  let input = estimateTokens(TEST_SYSTEM_PROMPT) + estimateTokens(promptFor(attack, pagesBaseUrl));
  if (attack.surface === "web") input += ASSUMPTIONS.fetchedPageTokens * ASSUMPTIONS.pagesFetchedPerAttack;
  if (attack.surface === "image" || attack.surface === "shared") input += ASSUMPTIONS.imageTokens;
  if (attack.surface === "file") input += ASSUMPTIONS.fileTokens;
  const answer = usd(model, input, ASSUMPTIONS.answerTokens);
  const grader = usd(model, ASSUMPTIONS.graderInputTokens, ASSUMPTIONS.graderOutputTokens);
  return answer + grader;
}

export interface RunEstimate {
  perAttack: Array<{ id: string; usd: number }>;
  repeat: number;
  totalUsd: number;
}

export function estimateRunUsd(attacks: readonly Attack[], model: string, repeat: number, pagesBaseUrl?: string): RunEstimate {
  const perAttack = attacks.map((attack) => ({ id: attack.id, usd: estimateAttackUsd(attack, model, pagesBaseUrl) }));
  const totalUsd = perAttack.reduce((sum, a) => sum + a.usd, 0) * repeat;
  return { perAttack, repeat, totalUsd };
}

/** Spend counter of one run. `reserve` throws before a call that would pass the cap, so the run stops instead of overspending. */
export class BudgetGuard {
  private spent = 0;
  private readonly capUsd: number;

  constructor(capUsd: number) {
    this.capUsd = capUsd;
    if (!(capUsd > 0) || capUsd > MAX_BUDGET_USD) throw new Error(`the budget must be above 0 and at most ${MAX_BUDGET_USD} USD (got ${capUsd})`);
  }

  reserve(usd: number): void {
    if (this.spent + usd > this.capUsd) {
      throw new Error(`budget cap reached: ${this.spent.toFixed(3)} USD spent, ${usd.toFixed(3)} more would pass the cap of ${this.capUsd} USD`);
    }
    this.spent += usd;
  }

  get spentUsd(): number {
    return this.spent;
  }
}

/** The cap from `REDTEAM_BUDGET_USD`, or the maximum. */
export function capFromEnv(env: NodeJS.ProcessEnv): number {
  const raw = env["REDTEAM_BUDGET_USD"];
  return raw === undefined || raw === "" ? MAX_BUDGET_USD : Number(raw);
}
