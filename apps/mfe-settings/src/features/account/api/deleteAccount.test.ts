import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { describe, expect, it } from "vitest";
import { DeleteAccountError, deleteAccount } from "./deleteAccount";

describe("deleteAccount", () => {
  it("sends DELETE /auth/me with the password in the body and the session cookie", async () => {
    const requests = recordRequests();

    await deleteAccount("Secret-123");

    expect(requests.map((r) => `${r.method} ${new URL(r.url).pathname}`)).toEqual(["DELETE /auth/me"]);
    expect(requests[0]!.credentials).toBe("include");
    expect(requests[0]!.headers.get("Content-Type")).toBe("application/json");
    expect(requests[0]!.headers.get("X-Correlation-Id")).toBeTruthy();
    expect(await requests[0]!.json()).toEqual({ password: "Secret-123" });
  });

  it("throws the status, code and message of auth-service's error", async () => {
    server.use(
      http.delete("*/auth/me", () =>
        HttpResponse.json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid password" } }, { status: 401 }),
      ),
    );

    const error = await deleteAccount("wrong").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(DeleteAccountError);
    expect(error).toMatchObject({ status: 401, code: "INVALID_CREDENTIALS", message: "Invalid password" });
  });

  it("uses a generic message when the error has no JSON body", async () => {
    server.use(http.delete("*/auth/me", () => new HttpResponse("Bad gateway", { status: 502 })));

    await expect(deleteAccount("Secret-123")).rejects.toMatchObject({
      status: 502,
      code: undefined,
      message: "Failed to delete the account",
    });
  });

  it("ignores an error body without a code or message", async () => {
    server.use(http.delete("*/auth/me", () => HttpResponse.json({ error: { code: 7 } }, { status: 503 })));

    await expect(deleteAccount("Secret-123")).rejects.toMatchObject({
      status: 503,
      code: undefined,
      message: "Failed to delete the account",
    });
  });

  it("throws status 0 when the server cannot be reached", async () => {
    server.use(http.delete("*/auth/me", () => HttpResponse.error()));

    await expect(deleteAccount("Secret-123")).rejects.toMatchObject({ status: 0, message: "Could not reach the server" });
  });
});
