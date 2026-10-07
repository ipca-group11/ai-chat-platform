import { describe, expect, it, vi } from "vitest";
import { createReplyStopClient } from "./reply-stop-client.js";

const token = "t".repeat(32);

describe("createReplyStopClient (AICHAT-203)", () => {
  it("posts to the internal stop route of the user with the service token and returns the count", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ stopped: 2 }));
    const client = createReplyStopClient({ baseUrl: "http://conversation:4002", token, fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.stopUserReplies("u1")).resolves.toBe(2);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.href).toBe("http://conversation:4002/internal/sessions/u1/stop");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${token}`);
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("encodes the user id so it cannot change the path", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ stopped: 0 }));
    const client = createReplyStopClient({ baseUrl: "http://c:4002", token, fetchImpl: fetchImpl as unknown as typeof fetch });

    await client.stopUserReplies("../erasures");

    const [url] = fetchImpl.mock.calls[0] as unknown as [URL];
    expect(url.pathname).toBe("/internal/sessions/..%2Ferasures/stop");
  });

  it("rejects on an error status, so logout can report it", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 401 }));
    const client = createReplyStopClient({ baseUrl: "http://c:4002", token, fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.stopUserReplies("u1")).rejects.toThrow("status 401");
  });
});
