import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PactV3 } from "@pact-foundation/pact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { newConsumerPact, pactDir, removePacts, routeFetchTo, runWithMockServer } from "./consumer.js";

describe("pactDir (AICHAT-11)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves pacts/ at the workspace root, whichever app runs the test", () => {
    const root = mkdtempSync(join(tmpdir(), "pact-root-"));
    writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n");
    const app = join(root, "apps", "mfe-auth");
    mkdirSync(app, { recursive: true });

    expect(pactDir(app)).toBe(join(root, "pacts"));
  });

  it("uses PACT_DIR_OVERRIDE when set", () => {
    vi.stubEnv("PACT_DIR_OVERRIDE", "/tmp/somewhere");
    expect(pactDir()).toBe("/tmp/somewhere");
  });

  it("fails clearly outside a workspace", () => {
    expect(() => pactDir(tmpdir())).toThrow(/no pnpm-workspace.yaml/);
  });
});

describe("newConsumerPact / removePacts (AICHAT-11)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("writes <consumer>-<provider>.json with the names as given, into pactDir()", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pact-out-"));
    vi.stubEnv("PACT_DIR_OVERRIDE", dir);
    const pact = newConsumerPact("shell", "auth-service");
    pact.uponReceiving("a ping").withRequest({ method: "GET", path: "/ping" }).willRespondWith({ status: 204 });

    await pact.executeTest(async (server) => fetch(`${server.url}/ping`));

    expect(existsSync(join(dir, "shell-auth-service.json"))).toBe(true);
  });

  it("removes only the given consumer's pact files", () => {
    const dir = mkdtempSync(join(tmpdir(), "pact-out-"));
    for (const f of ["mfe-chat-auth-service.json", "mfe-chat-conversation-service.json", "mfe-chat-old.txt", "shell-auth-service.json"]) {
      writeFileSync(join(dir, f), "{}");
    }

    removePacts("mfe-chat", dir);

    expect(readdirSync(dir).sort()).toEqual(["mfe-chat-old.txt", "shell-auth-service.json"]);
  });

  it("does nothing when the folder does not exist yet", () => {
    expect(() => removePacts("mfe-chat", join(tmpdir(), "no-such-pacts-dir"))).not.toThrow();
  });
});

describe("routeFetchTo (AICHAT-11)", () => {
  function recordingFetch() {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return new Response(null, { status: 204 });
    }) as typeof fetch;
    return { calls, fetchImpl };
  }

  it("sends a relative URL to the mock server and keeps the query and options", async () => {
    const { calls, fetchImpl } = recordingFetch();
    const routed = routeFetchTo("http://127.0.0.1:1234", { fetchImpl });

    await routed("/auth/me?x=1", { method: "GET", credentials: "include" });

    expect(calls).toEqual([{ url: "http://127.0.0.1:1234/auth/me?x=1", init: { method: "GET", credentials: "include" } }]);
  });

  it("removes the proxy prefix like the shell does (/api/chats -> /chats)", async () => {
    const { calls, fetchImpl } = recordingFetch();
    const routed = routeFetchTo("http://127.0.0.1:1234", { stripPrefix: "/api", fetchImpl });

    await routed("/api/chats/c1/stop");
    await routed("/api");
    await routed("/apiary");

    expect(calls.map((c) => c.url)).toEqual([
      "http://127.0.0.1:1234/chats/c1/stop",
      "http://127.0.0.1:1234/",
      "http://127.0.0.1:1234/apiary",
    ]);
  });

  it("accepts absolute URLs and Request objects", async () => {
    const { calls, fetchImpl } = recordingFetch();
    const routed = routeFetchTo("http://127.0.0.1:1234", { fetchImpl });

    await routed(new URL("http://localhost:8000/auth/login"));
    await routed(new Request("http://localhost:8000/auth/logout"));

    expect(calls.map((c) => c.url)).toEqual(["http://127.0.0.1:1234/auth/login", "http://127.0.0.1:1234/auth/logout"]);
  });
});

describe("runWithMockServer (AICHAT-11)", () => {
  function pactIn(dir: string) {
    const pact = new PactV3({ consumer: "c", provider: "p", dir, logLevel: "error" });
    pact.uponReceiving("a ping").withRequest({ method: "GET", path: "/ping" }).willRespondWith({ status: 204 });
    return pact;
  }

  it("lets relative fetch calls reach the mock server, restores fetch and writes the pact", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pact-out-"));
    const original = globalThis.fetch;

    const status = await runWithMockServer(pactIn(dir), async () => (await fetch("/api/ping")).status, {
      stripPrefix: "/api",
    });

    expect(status).toBe(204);
    expect(globalThis.fetch).toBe(original);
    expect(JSON.parse(readFileSync(join(dir, "c-p.json"), "utf8")).interactions).toHaveLength(1);
  });

  it("writes the pact and rejects like the client when the client rejects on an error status", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pact-out-"));
    const pact = new PactV3({ consumer: "c", provider: "p", dir, logLevel: "error" });
    pact.uponReceiving("a forbidden ping").withRequest({ method: "GET", path: "/ping" }).willRespondWith({ status: 403 });
    const client = async () => {
      const res = await fetch("/ping");
      if (!res.ok) throw new Error(`status ${res.status}`);
    };

    await expect(runWithMockServer(pact, client)).rejects.toThrow("status 403");

    expect(JSON.parse(readFileSync(join(dir, "c-p.json"), "utf8")).interactions[0].response.status).toBe(403);
  });

  it("fails, restores fetch and writes no pact when the declared request never arrives", async () => {
    const dir = mkdtempSync(join(tmpdir(), "pact-out-"));
    const original = globalThis.fetch;

    await expect(runWithMockServer(pactIn(dir), async () => undefined)).rejects.toThrow();

    expect(globalThis.fetch).toBe(original);
    expect(existsSync(join(dir, "c-p.json"))).toBe(false);
  });
});
