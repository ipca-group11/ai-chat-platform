import express, { Router } from "express";
import { anthropicMessage, anthropicReply, anthropicStream, messageId } from "../llm/anthropic.js";
import { providerError, requestId } from "../llm/errors.js";
import { isReplay } from "../llm/replay.js";
import { serveReplay } from "../llm/serve-replay.js";
import { planScenario, scenarioDefinitions } from "../llm/scenarios.js";
import { availableScenarios, selectScenario } from "../llm/select.js";
import { dropConnection, openEventStream, writeFrames } from "../llm/sse.js";
import { sleep } from "../middleware.js";
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
      const requestedModel = typeof request.model === "string" && request.model ? request.model : DEFAULT_MODEL;
      const { scenario: name, model } = selectScenario(req, requestedModel);

      const failure = providerError("anthropic", name, requestId(ctx.rng));
      if (failure) {
        res.status(failure.status).set(failure.headers).json(failure.body);
        return;
      }
      if (isReplay(name)) {
        await serveReplay("anthropic", name, ctx, req, res);
        return;
      }
      if (!Array.isArray(request.messages)) {
        res.status(400).json(errorBody("invalid_request_error", "messages: Field required"));
        return;
      }
      const plan = planScenario("anthropic", name, ctx.config);
      if (!plan) {
        res
          .status(400)
          .json(errorBody("invalid_request_error", `Unknown mock scenario "${name}". Available: ${availableScenarios(ctx, "anthropic")}`));
        return;
      }

      const last = request.messages[request.messages.length - 1] as { role?: unknown } | undefined;
      const reply = anthropicReply(plan, ctx.config.seed, last?.role === "assistant");
      const id = messageId(ctx.rng);

      if (request.stream !== true) {
        if (reply.firstTokenDelayMs > 0) await sleep(reply.firstTokenDelayMs);
        if (reply.dropped) {
          res.destroy();
          return;
        }
        res.json(anthropicMessage(reply, model, id));
        return;
      }
      const signal = openEventStream(req, res);
      await writeFrames(res, anthropicStream(reply, { model, id, config: ctx.config, signal }));
      if (reply.dropped) await dropConnection(res);
      else res.end();
    });

    return router;
  },
};
