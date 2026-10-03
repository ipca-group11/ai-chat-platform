import express, { Router } from "express";
import { providerError, requestId } from "../llm/errors.js";
import { completionId, openAiCompletion, openAiReply, openAiStream } from "../llm/openai.js";
import { isReplay } from "../llm/replay.js";
import { serveReplay } from "../llm/serve-replay.js";
import { planScenario, scenarioDefinitions } from "../llm/scenarios.js";
import { availableScenarios, selectScenario } from "../llm/select.js";
import { dropConnection, openEventStream, writeFrames } from "../llm/sse.js";
import { sleep } from "../middleware.js";
import type { MockModule } from "../registry.js";

const DEFAULT_MODEL = "gpt-4o";

const errorBody = (message: string, code: string | null = null, param: string | null = null) => ({
  error: { message, type: "invalid_request_error", param, code },
});

/** OpenAI mock: `POST /openai/v1/chat/completions`, streaming and not. */
export const openaiMock: MockModule = {
  name: "openai",
  mountPath: "/openai",
  scenarios: scenarioDefinitions("openai"),
  createRouter(ctx) {
    const router = Router();
    router.use(express.json({ limit: "10mb" }));

    router.post("/v1/chat/completions", async (req, res) => {
      const body: unknown = req.body;
      const request = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
      const requestedModel = typeof request.model === "string" && request.model ? request.model : DEFAULT_MODEL;
      const { scenario: name, model } = selectScenario(req, requestedModel);

      const failure = providerError("openai", name, requestId(ctx.rng));
      if (failure) {
        res.status(failure.status).set(failure.headers).json(failure.body);
        return;
      }
      if (isReplay(name)) {
        await serveReplay("openai", name, ctx, req, res);
        return;
      }
      if (!Array.isArray(request.messages)) {
        res.status(400).json(errorBody("Missing required parameter: 'messages'.", "missing_required_parameter", "messages"));
        return;
      }
      const plan = planScenario("openai", name, ctx.config);
      if (!plan) {
        res
          .status(400)
          .json(errorBody(`Unknown mock scenario "${name}". Available: ${availableScenarios(ctx, "openai")}`, "unknown_scenario"));
        return;
      }

      const reply = openAiReply(plan, ctx.config.seed);
      const id = completionId(ctx.rng);

      if (request.stream !== true) {
        if (reply.firstTokenDelayMs > 0) await sleep(reply.firstTokenDelayMs);
        if (reply.dropped) {
          res.destroy();
          return;
        }
        res.json(openAiCompletion(reply, model, id));
        return;
      }
      const options = request.stream_options as { include_usage?: unknown } | undefined;
      const signal = openEventStream(req, res);
      await writeFrames(
        res,
        openAiStream(reply, { model, id, config: ctx.config, includeUsage: options?.include_usage === true, signal }),
      );
      if (reply.dropped) await dropConnection(res);
      else res.end();
    });

    return router;
  },
};
