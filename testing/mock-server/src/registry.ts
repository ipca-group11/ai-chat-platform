import type { Router } from "express";
import type { MockConfig } from "./config.js";
import type { Dataset } from "./data/types.js";
import type { Rng } from "./prng.js";

/** A named behavior a mock can be switched to (X-Mock-Scenario header or /__admin/faults). */
export interface ScenarioDefinition {
  /** Mock that owns the scenario, e.g. `anthropic`. */
  mock: string;
  /** Scenario name, e.g. `error-429`. */
  name: string;
  description: string;
}

export interface ScenarioRegistry {
  register(...scenarios: ScenarioDefinition[]): void;
  list(): ScenarioDefinition[];
  has(mock: string, name: string): boolean;
}

export function createScenarioRegistry(): ScenarioRegistry {
  const scenarios = new Map<string, ScenarioDefinition>();
  const keyOf = (mock: string, name: string) => `${mock}/${name}`;
  return {
    register(...definitions) {
      for (const definition of definitions) {
        const key = keyOf(definition.mock, definition.name);
        if (scenarios.has(key)) throw new Error(`Scenario "${key}" is already registered`);
        scenarios.set(key, definition);
      }
    },
    list: () =>
      [...scenarios.values()].sort((a, b) => keyOf(a.mock, a.name).localeCompare(keyOf(b.mock, b.name))),
    has: (mock, name) => scenarios.has(keyOf(mock, name)),
  };
}

/** The records the mocks serve. Replaced as a whole by `/__admin/seed/<dataset>`. */
export interface DataStore {
  /** Name of the dataset currently loaded. */
  readonly name: string;
  /** The records; read it on every request, because a seed swaps the object. */
  readonly data: Dataset;
  /** Replaces the records with a named dataset; throws for an unknown name. */
  load(name: string): void;
}

/** What every mock receives when its router is created. */
export interface MockContext {
  config: MockConfig;
  /** Seeded generator, back to its first value after `/__admin/reset`. */
  rng: Rng;
  scenarios: ScenarioRegistry;
  store: DataStore;
  /** Registers a function that clears the mock's own state on `/__admin/reset`. */
  onReset(hook: () => void): void;
}

/**
 * One mock = one Express router mounted on one path. To add or fill a mock, create a file
 * in `src/routers/` that exports a MockModule and add one line to `src/routers/index.ts`.
 */
export interface MockModule {
  /** Unique name; also the scenario owner. */
  name: string;
  /** Path the router is mounted on, e.g. `/anthropic`. */
  mountPath: string;
  /** Scenarios this mock supports (listed by `/__admin/scenarios`). */
  scenarios?: ScenarioDefinition[];
  createRouter(ctx: MockContext): Router;
}
