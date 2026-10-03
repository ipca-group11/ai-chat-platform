import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { loadConfig } from "../config.js";
import { fixturesDir, replayFrames } from "./replay.js";

const env = { TTFT_MS: "0", TOKEN_INTERVAL_MS: "0" };
const messages = [{ role: "user", content: "hi" }];

const replay = (path: string, fixture: string, app = createApp(loadConfig(env)).app) =>
  request(app)
    .post(path)
    .set("X-Mock-Scenario", `replay:${fixture}`)
    .buffer(true)
    .parse((res, done) => {
      const parts: Buffer[] = [];
      res.on("data", (chunk: Buffer) => parts.push(chunk));
      res.on("end", () => done(null, Buffer.concat(parts)));
    })
    .send({ messages, stream: true });

const recorded = async (provider: string, fixture: string) =>
  readFile(join(fixturesDir({ fixturesDir: undefined }), provider, `${fixture}.sse`));

describe("replay of the AICHAT-25 recordings", () => {
  it.each(["text", "thinking", "max-tokens", "pause-turn-1", "overloaded-midstream", "web-fetch-error", "text-ping"])(
    "serves anthropic %s byte for byte",
    async (fixture) => {
      const res = await replay("/anthropic/v1/messages", fixture);
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/event-stream");
      expect(Buffer.compare(res.body as Buffer, await recorded("anthropic", fixture))).toBe(0);
    },
  );

  it.each(["text", "max-tokens", "reasoning", "error-midstream"])("serves openai %s byte for byte", async (fixture) => {
    const res = await replay("/openai/v1/chat/completions", fixture);
    expect(res.status).toBe(200);
    expect(Buffer.compare(res.body as Buffer, await recorded("openai", fixture))).toBe(0);
  });

  it("accepts the fixture through the model suffix as well", async () => {
    const res = await request(createApp(loadConfig(env)).app)
      .post("/openai/v1/chat/completions")
      .send({ model: "gpt-4o@replay:text", messages });
    expect(res.status).toBe(200);
    expect(res.text).toContain("[DONE]");
  });
});

describe("missing fixtures", () => {
  it("answers 404 in the Anthropic error shape and lists the fixtures that exist", async () => {
    const res = await request(createApp(loadConfig(env)).app)
      .post("/anthropic/v1/messages")
      .set("X-Mock-Scenario", "replay:nope")
      .send({ messages });
    expect(res.status).toBe(404);
    expect(res.body.type).toBe("error");
    expect(res.body.error.type).toBe("not_found_error");
    expect(res.body.error.message).toContain('"nope"');
    expect(res.body.error.message).toContain("thinking");
  });

  it("answers 404 in the OpenAI error shape", async () => {
    const res = await request(createApp(loadConfig(env)).app)
      .post("/openai/v1/chat/completions")
      .set("X-Mock-Scenario", "replay:nope")
      .send({ messages });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: "fixture_not_found", param: null });
    expect(res.body.error.message).toContain("reasoning");
  });

  it("does not read outside the fixtures folder", async () => {
    for (const fixture of ["../../package", "..%2Fpackage", "a/b"]) {
      const res = await request(createApp(loadConfig(env)).app)
        .post("/openai/v1/chat/completions")
        .set("X-Mock-Scenario", `replay:${fixture}`)
        .send({ messages });
      expect(res.status).toBe(404);
    }
  });
});

describe("FIXTURES_DIR", () => {
  let dir: string;
  afterAll(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("serves fixtures from the folder it names, including bytes that are not UTF-8", async () => {
    dir = await mkdtemp(join(tmpdir(), "mock-fixtures-"));
    await mkdir(join(dir, "openai"));
    const bytes = Buffer.concat([Buffer.from("data: {\"a\":\""), Buffer.from([0xff, 0xfe, 0xc3]), Buffer.from("\"}\n\ndata: [DONE]\n\n")]);
    await writeFile(join(dir, "openai", "odd.sse"), bytes);
    const app = createApp(loadConfig({ ...env, FIXTURES_DIR: dir })).app;
    const res = await replay("/openai/v1/chat/completions", "odd", app);
    expect(Buffer.compare(res.body as Buffer, bytes)).toBe(0);
    const missing = await replay("/anthropic/v1/messages", "odd", app);
    expect(missing.status).toBe(404);
    expect(missing.body.toString()).toContain("Available: none");
  });
});

describe("fixturesDir", () => {
  it("falls back to a folder under the start directory when no workspace root is above it", () => {
    expect(fixturesDir({ fixturesDir: undefined }, "/")).toBe(
      "/services/conversation-service/src/test-utils/fixtures/llm",
    );
  });
});

describe("replayFrames", () => {
  it("paces the frames: TTFT before the first, the interval before each other", async () => {
    const frames: string[] = [];
    for await (const frame of replayFrames(Buffer.from("a\n\nb\n\n"), { ttftMs: 0, tokenIntervalMs: 0 })) {
      frames.push(frame.toString());
    }
    expect(frames).toEqual(["a\n\n", "b\n\n"]);
  });

  it("stops when the client has gone", async () => {
    const controller = new AbortController();
    controller.abort();
    const frames: Buffer[] = [];
    for await (const frame of replayFrames(Buffer.from("a\n\n"), { ttftMs: 0, tokenIntervalMs: 0 }, controller.signal)) {
      frames.push(frame);
    }
    expect(frames).toEqual([]);
  });
});
