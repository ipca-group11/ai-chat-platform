import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const waitForStack = vi.hoisted(() => vi.fn());
const targets = vi.hoisted(() => [{ name: "shell", url: "http://x/" }]);

vi.mock("./wait-for-stack.js", () => ({
  waitForStack,
  defaultStackTargets: () => targets,
}));

/** Loads the CLI fresh (it runs on import) and lets its promise chain settle. */
async function runCli() {
  vi.resetModules();
  await import("./wait-for-stack-cli.js");
  await new Promise((resolve) => setImmediate(resolve));
}

describe("wait-for-stack CLI", () => {
  const savedExitCode = process.exitCode;
  const savedTimeout = process.env["E2E_WAIT_TIMEOUT_MS"];

  beforeEach(() => {
    waitForStack.mockReset();
    process.exitCode = undefined;
    delete process.env["E2E_WAIT_TIMEOUT_MS"];
  });

  afterEach(() => {
    process.exitCode = savedExitCode;
    if (savedTimeout === undefined) delete process.env["E2E_WAIT_TIMEOUT_MS"];
    else process.env["E2E_WAIT_TIMEOUT_MS"] = savedTimeout;
    vi.restoreAllMocks();
  });

  it("waits for the default targets with a 3 minute budget when no timeout is set", async () => {
    waitForStack.mockResolvedValue(undefined);

    await runCli();

    expect(waitForStack).toHaveBeenCalledExactlyOnceWith(targets, { timeoutMs: 180_000 });
  });

  it("reads the time budget from E2E_WAIT_TIMEOUT_MS", async () => {
    process.env["E2E_WAIT_TIMEOUT_MS"] = "5000";
    waitForStack.mockResolvedValue(undefined);

    await runCli();

    expect(waitForStack).toHaveBeenCalledWith(targets, { timeoutMs: 5000 });
  });

  it("exits with code 0 (leaves exitCode unset) when the stack is healthy", async () => {
    waitForStack.mockResolvedValue(undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await runCli();

    expect(process.exitCode).toBeUndefined();
    expect(error).not.toHaveBeenCalled();
  });

  it("prints the message and exits with code 1 when the stack is not healthy", async () => {
    waitForStack.mockRejectedValue(new Error("One or more services are not healthy"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await runCli();

    expect(error).toHaveBeenCalledWith("One or more services are not healthy");
    expect(process.exitCode).toBe(1);
  });

  it("prints a non-Error rejection as it is and still exits with code 1", async () => {
    waitForStack.mockRejectedValue("plain string");
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await runCli();

    expect(error).toHaveBeenCalledWith("plain string");
    expect(process.exitCode).toBe(1);
  });
});
