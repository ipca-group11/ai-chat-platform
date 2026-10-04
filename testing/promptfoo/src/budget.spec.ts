import { describe, expect, it } from "vitest";
import { ATTACKS, attackById } from "./attacks.ts";
import { BudgetGuard, MAX_BUDGET_USD, baseModel, capFromEnv, estimateAttackUsd, estimateRunUsd, estimateTokens, priceOf } from "./budget.ts";

describe("estimates", () => {
  it("counts about one token per four characters", () => {
    expect(estimateTokens("abcdefgh")).toBe(2);
    expect(estimateTokens("")).toBe(0);
  });

  it("knows the price of the Haiku class model, also with a mock scenario suffix, and refuses other models", () => {
    expect(priceOf(baseModel("claude-haiku-4-5@inject-obey"))).toEqual({ input: 1, output: 5 });
    expect(() => priceOf("claude-opus-4")).toThrow(/no price for model/);
    expect(() => estimateAttackUsd(attackById("A7a"), "claude-opus-4")).toThrow(/no price/);
  });

  it("costs a web attack more than a direct one, because of the page it brings in", () => {
    const direct = estimateAttackUsd(attackById("A7a"), "claude-haiku-4-5");
    const web = estimateAttackUsd(attackById("A4"), "claude-haiku-4-5");
    expect(web).toBeGreaterThan(direct);
    expect(direct).toBeGreaterThan(0);
  });

  it("adds file and image tokens for the file attacks", () => {
    const direct = estimateAttackUsd(attackById("A7a"), "claude-haiku-4-5");
    expect(estimateAttackUsd(attackById("A1"), "claude-haiku-4-5")).toBeGreaterThan(direct);
    expect(estimateAttackUsd(attackById("A2b"), "claude-haiku-4-5")).toBeGreaterThan(direct);
  });

  it("keeps a whole run of the attack set, twice, well under the cap of 2 USD", () => {
    const run = estimateRunUsd(ATTACKS, "claude-haiku-4-5", 2);
    expect(run.perAttack).toHaveLength(ATTACKS.length);
    expect(run.totalUsd).toBeGreaterThan(0);
    expect(run.totalUsd).toBeLessThan(MAX_BUDGET_USD / 2);
  });
});

describe("BudgetGuard", () => {
  it("lets calls through until the cap would be passed, then stops", () => {
    const guard = new BudgetGuard(1);
    guard.reserve(0.6);
    expect(() => guard.reserve(0.5)).toThrow(/budget cap reached/);
    guard.reserve(0.4);
    expect(guard.spentUsd).toBeCloseTo(1);
  });

  it("refuses a cap above 2 USD or not above 0", () => {
    expect(() => new BudgetGuard(3)).toThrow(/at most 2/);
    expect(() => new BudgetGuard(0)).toThrow();
    expect(() => new BudgetGuard(Number.NaN)).toThrow();
  });

  it("reads the cap from REDTEAM_BUDGET_USD and defaults to the maximum", () => {
    expect(capFromEnv({})).toBe(2);
    expect(capFromEnv({ REDTEAM_BUDGET_USD: "" })).toBe(2);
    expect(capFromEnv({ REDTEAM_BUDGET_USD: "0.5" })).toBe(0.5);
  });
});
