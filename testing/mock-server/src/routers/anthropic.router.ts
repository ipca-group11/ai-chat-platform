import express, { Router } from "express";
import { anthropicMessage, anthropicReply, anthropicStream, messageId } from "../llm/anthropic.js";
import { planScenario, scenarioDefinitions } from "../llm/scenarios.js";
import { availableScenarios, selectScenario } from "../llm/select.js";
import { openEventStream, writeFrames } from "../llm/sse.js";
import type { MockModule } from "../registry.js";

const DEFAULT_MODEL = "claude-sonnet-4-5";

const errorBody = (type: string, message: string) => ({ type: "error", error: { type, message } });

/** Anthropic mock: `POST /anthropic/v1/messages`, streaming and not. */
export const anthropicMock: MockModule = {
  name: "anthropic",
  mountPath: "/anthropic",
  scenarios: scenarioDefinitions("anthropic"),
  createRouter(ctx) {
    const router = Router();
    router.use(express.json({ limit: "10mb" }));

    router.post("/v1/messages", async (req, res) => {
      const body: unknown = req.body;
      const request = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
      if (!Array.isArray(request.messages)) {
        res.status(400).json(errorBody("invalid_request_error", "messages: Field required"));
        return;
      }
      const requestedModel = typeof request.model === "string" && request.model ? request.model : DEFAULT_MODEL;

      const { scenario: name, model } = selectScenario(req, requestedModel);
      const plan = planScenario("anthropic", name, ctx.config);
      if (!plan) {
        res.status(400).json(errorBody("invalid_request_error", `Unknown mock scenario "${name}". Available: ${availableScenarios(ctx, "anthropic")}`));
        return;
      }

      const last = request.messages[request.messages.length - 1] as { role?: unknown } | undefined;
      const reply = anthropicReply(plan, ctx.config.seed, last?.role === "assistant");
      const id = messageId(ctx.rng);

      if (request.stream !== true) {
        res.json(anthropicMessage(reply, model, id));
        return;
      }
      const signal = openEventStream(req, res);
      await writeFrames(res, anthropicStream(reply, { model, id, config: ctx.config, signal }));
      res.end();
    });

    return router;
  },
};
