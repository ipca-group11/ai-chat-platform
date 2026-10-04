import { randomBytes } from "node:crypto";
import { attackById } from "./attacks.ts";
import { BudgetGuard, baseModel, capFromEnv, estimateAttackUsd } from "./budget.ts";
import { runAttack, type RunSettings } from "./scenario.ts";

/** What promptfoo expects back from `callApi`. */
export interface ProviderResponse {
  output?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

interface CallContext {
  vars?: Record<string, unknown>;
}

export interface ProviderEnv {
  [key: string]: string | undefined;
}

/**
 * promptfoo custom provider (TypeScript): one test case is one attack from `attacks.ts`. It signs in, creates
 * the chats, attaches the file, sends the messages and reads the SSE stream through the real app API, then
 * hands the answer and the fetched URLs to the assertions.
 *
 * Settings come from the environment: `REDTEAM_APP_URL` (default http://localhost:8000), `REDTEAM_MODEL`
 * (default claude-haiku-4-5), `ANTHROPIC_API_KEY` (any text for the mock), `PAGES_BASE_URL`,
 * `REDTEAM_BUDGET_USD` (cap, at most 2). A live model (no `@scenario` in the model name) is charged to the cap.
 */
export default class AppApiProvider {
  private readonly guard: BudgetGuard;
  private readonly runId = randomBytes(4).toString("hex");
  private readonly env: ProviderEnv;
  private readonly run: typeof runAttack;

  /** promptfoo calls `new Provider({ id, config })`; tests pass `{ testEnv, run }` instead. */
  constructor(options: { testEnv?: ProviderEnv; run?: typeof runAttack } = {}) {
    this.env = options.testEnv ?? process.env;
    this.run = options.run ?? runAttack;
    this.guard = new BudgetGuard(capFromEnv(this.env as NodeJS.ProcessEnv));
  }

  id(): string {
    return "app-api";
  }

  async callApi(_prompt: string, context?: CallContext): Promise<ProviderResponse> {
    const attackId = String(context?.vars?.["attack"] ?? "");
    const model = this.env["REDTEAM_MODEL"] ?? "claude-haiku-4-5";
    const pagesBaseUrl = this.env["PAGES_BASE_URL"] ?? "http://attack-pages";
    try {
      const attack = attackById(attackId);
      // A known gap cannot reach the model today, so the attack is reported, never counted as a pass. REDTEAM_INCLUDE_GAPS=1 plays it anyway (after a fix).
      if (attack.knownGap && this.env["REDTEAM_INCLUDE_GAPS"] !== "1") return { error: `known gap, not counted as a pass: ${attack.knownGap}` };
      // The mock (a model name with @scenario) costs nothing; a live model is charged to the cap before the call.
      if (!model.includes("@")) this.guard.reserve(estimateAttackUsd(attack, model, pagesBaseUrl));
      const settings: RunSettings = {
        baseUrl: (this.env["REDTEAM_APP_URL"] ?? "http://localhost:8000").replace(/\/+$/, ""),
        model,
        apiKey: this.env["ANTHROPIC_API_KEY"] ?? "mock-key-not-a-secret",
        pagesBaseUrl,
        runId: this.runId,
      };
      const reply = await this.run(attack, settings);
      if (reply.error) return { error: `the app reported a provider error: ${reply.error}` };
      return {
        output: reply.text,
        metadata: { attack: attack.id, surface: attack.surface, model: baseModel(model), fetchedUrls: reply.fetchedUrls, refusedUrls: reply.refusedUrls, knownGap: attack.knownGap ?? null },
      };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }
}

