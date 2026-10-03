import express, { type Express } from "express";
import { createAdminRouter } from "./admin/admin.router.js";
import { loadConfig, type MockConfig } from "./config.js";
import { latency, randomErrors } from "./middleware.js";
import { createRng } from "./prng.js";
import { createScenarioRegistry, type MockContext, type MockModule } from "./registry.js";
import { mockModules } from "./routers/index.js";

export interface MockApp {
  app: Express;
  ctx: MockContext;
}

/** Builds the Express app: admin endpoints plus one router per mock. */
export function createApp(config: MockConfig = loadConfig(), modules: MockModule[] = mockModules): MockApp {
  const rng = createRng(config.seed);
  const resetHooks: Array<() => void> = [];
  const ctx: MockContext = {
    config,
    rng,
    scenarios: createScenarioRegistry(),
    onReset: (hook) => {
      resetHooks.push(hook);
    },
  };

  const app = express();
  app.disable("x-powered-by");

  const reset = (): void => {
    rng.reset();
    for (const hook of resetHooks) hook();
  };
  app.use("/__admin", express.json(), createAdminRouter({ ctx, reset }));

  for (const mock of modules) {
    if (mock.scenarios) ctx.scenarios.register(...mock.scenarios);
    app.use(mock.mountPath, latency(config), randomErrors(config, rng), mock.createRouter(ctx));
  }

  app.use((req, res) => {
    res.status(404).json({ error: { code: "not_mocked", message: `No mock for ${req.method} ${req.path}` } });
  });

  return { app, ctx };
}
