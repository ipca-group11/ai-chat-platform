import { describe, expect, it, vi } from "vitest";
import { defaultStackTargets, waitForHealth, waitForStack } from "./wait-for-stack.js";

function okResponse(): Response {
  return { ok: true, status: 200 } as Response;
}

function failResponse(status: number): Response {
  return { ok: false, status } as Response;
}

describe("waitForHealth (AC-98)", () => {
  it("AC-98: resolves immediately when the endpoint is already healthy", async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse());
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    await waitForHealth(
      { name: "shell", url: "http://localhost:4173/" },
      { fetchFn, sleepFn },
    );

    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleepFn).not.toHaveBeenCalled();
  });

  it("retries until the endpoint becomes healthy (AC-98)", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(failResponse(503))
      .mockResolvedValueOnce(failResponse(503))
      .mockResolvedValueOnce(okResponse());
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    await waitForHealth(
      { name: "auth-service", url: "http://localhost:3001/health" },
      { fetchFn, sleepFn, intervalMs: 10 },
    );

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleepFn).toHaveBeenCalledTimes(2);
  });

  it("throws a descriptive error once the timeout elapses (AC-98)", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    let now = 0;
    const sleepFn = vi.fn().mockImplementation(async () => {
      now += 20;
    });
    const nowSpy = vi.spyOn(Date, "now").mockImplementation(() => now);

    await expect(
      waitForHealth(
        { name: "conversation-service", url: "http://localhost:3002/health" },
        { fetchFn, sleepFn, intervalMs: 20, timeoutMs: 50 },
      ),
    ).rejects.toThrow(/conversation-service/);

    nowSpy.mockRestore();
  });
});

describe("waitForStack (AC-98)", () => {
  it("AC-98: resolves once every target is healthy", async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse());

    await expect(
      waitForStack(
        [
          { name: "shell", url: "http://localhost:4173/" },
          { name: "auth-service", url: "http://localhost:3001/health" },
        ],
        { fetchFn, sleepFn: vi.fn().mockResolvedValue(undefined) },
      ),
    ).resolves.toBeUndefined();
  });

  it("aggregates failures from every unhealthy target (AC-98)", async () => {
    const fetchFn = vi.fn().mockImplementation(async (url: string) =>
      url.includes("auth") ? okResponse() : failResponse(500),
    );

    await expect(
      waitForStack(
        [
          { name: "shell", url: "http://localhost:4173/" },
          { name: "auth-service", url: "http://localhost:3001/health" },
        ],
        { fetchFn, sleepFn: vi.fn().mockResolvedValue(undefined), timeoutMs: 20, intervalMs: 5 },
      ),
    ).rejects.toThrow(/shell/);
  });

  it("defaultStackTargets covers shell, auth-service, and conversation-service (AC-98)", () => {
    const names = defaultStackTargets().map((target) => target.name);
    expect(names).toEqual(["shell", "auth-service", "conversation-service"]);
  });
});
