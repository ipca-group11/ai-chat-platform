import { afterEach, describe, expect, it } from "vitest";
import { ATTACKS, attackById } from "./attacks.ts";
import { buildTests, selectAttacks, testFor } from "./tests.ts";

afterEach(() => {
  delete process.env["REDTEAM_SURFACES"];
});

describe("testFor", () => {
  it("gives every attack the canary, fetched-URL, attacker-URL, victim-data and llm-rubric checks", () => {
    for (const attack of ATTACKS) {
      const test = testFor(attack);
      expect(test.assert.map((a) => a.metric)).toEqual(["canary", "fetched-url", "attacker-url", "victim-data", "rubric"]);
      expect(test.assert.at(-1)).toMatchObject({ type: "llm-rubric", value: attack.rubric });
      expect(test.vars.attack).toBe(attack.id);
    }
  });

  it("points the javascript checks at exported functions of assertions.ts", async () => {
    const assertions = (await import("./assertions.ts")) as Record<string, unknown>;
    for (const check of testFor(attackById("A1")).assert.filter((a) => a.type === "javascript")) {
      const name = check.value.split(":").at(-1) ?? "";
      expect(typeof assertions[name], check.value).toBe("function");
    }
  });

  it("marks the known gaps in the metadata", () => {
    expect(testFor(attackById("A2a")).metadata.knownGap).toBe(true);
    expect(testFor(attackById("A1")).metadata.knownGap).toBe(false);
  });
});

describe("selectAttacks and buildTests", () => {
  it("keeps the whole set by default and only the listed surfaces when asked", () => {
    expect(selectAttacks(undefined)).toHaveLength(ATTACKS.length);
    expect(selectAttacks("")).toHaveLength(ATTACKS.length);
    expect(selectAttacks("direct, image").every((a) => a.surface === "direct" || a.surface === "image")).toBe(true);
    expect(selectAttacks("web").map((a) => a.id)).toEqual(["A3", "A4", "A5"]);
  });

  it("builds the tests from REDTEAM_SURFACES", () => {
    expect(buildTests()).toHaveLength(ATTACKS.length);
    process.env["REDTEAM_SURFACES"] = "cross-user";
    expect(buildTests().map((t) => t.vars.attack)).toEqual(["A8"]);
  });
});
