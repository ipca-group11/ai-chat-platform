import { describe, expect, it, vi } from "vitest";
import { createErasureClient } from "./erasure-client.js";

describe("createErasureClient", () => {
  it("posts the user to the internal endpoint with the service token", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const client = createErasureClient({ baseUrl: "http://conversation:4002", token: "t".repeat(32), fetchImpl: fetchImpl as unknown as typeof fetch });

    await client.eraseUser("u1", "u1@example.com");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.href).toBe("http://conversation:4002/internal/erasures");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe(`Bearer ${"t".repeat(32)}`);
    expect(JSON.parse(init.body as string)).toEqual({ userId: "u1", email: "u1@example.com" });
  });

  it("rejects when conversation-service answers with an error status", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 502 }));
    const client = createErasureClient({ baseUrl: "http://c:4002", token: "t".repeat(32), fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.eraseUser("u1", "u1@example.com")).rejects.toThrow("status 502");
  });

  it("rejects when the service cannot be reached", async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error("ECONNREFUSED")));
    const client = createErasureClient({ baseUrl: "http://c:4002", token: "t".repeat(32), fetchImpl: fetchImpl as unknown as typeof fetch });

    await expect(client.eraseUser("u1", "u1@example.com")).rejects.toThrow("ECONNREFUSED");
  });
});
