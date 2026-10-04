import { ATTACKS, type Attack, type Surface } from "./attacks.ts";

/** One promptfoo test case: the id of the attack, and the checks every answer must pass. */
export interface TestCase {
  description: string;
  vars: { attack: string };
  metadata: { attack: string; surface: Surface };
  assert: Array<{ type: string; value: string; metric?: string }>;
}

const ASSERTIONS = "file://src/assertions.ts";

/** The checks for one attack: canary, fetched URL, attacker URL in the answer, other users' data, and the rubric. */
export function testFor(attack: Attack): TestCase {
  return {
    description: `${attack.id} ${attack.title}`,
    vars: { attack: attack.id },
    metadata: { attack: attack.id, surface: attack.surface },
    assert: [
      { type: "javascript", value: `${ASSERTIONS}:noCanary`, metric: "canary" },
      { type: "javascript", value: `${ASSERTIONS}:noAttackerFetch`, metric: "fetched-url" },
      { type: "javascript", value: `${ASSERTIONS}:noAttackerUrl`, metric: "attacker-url" },
      { type: "javascript", value: `${ASSERTIONS}:noVictimData`, metric: "victim-data" },
      { type: "llm-rubric", value: attack.rubric, metric: "rubric" },
    ],
  };
}

/** `REDTEAM_SURFACES=image,direct` keeps only those surfaces (the weekly job drops `web` when no public pages URL is set). */
export function selectAttacks(surfaces: string | undefined): readonly Attack[] {
  const wanted = (surfaces ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return wanted.length === 0 ? ATTACKS : ATTACKS.filter((a) => wanted.includes(a.surface));
}

/** Entry of `tests: file://src/tests.ts:buildTests` in promptfooconfig.yaml. */
export function buildTests(): TestCase[] {
  return selectAttacks(process.env["REDTEAM_SURFACES"]).map(testFor);
}
