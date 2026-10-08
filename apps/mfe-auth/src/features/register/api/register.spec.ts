import { describe, expect, it } from "vitest";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { registerUser } from "./register";

describe("registerUser", () => {
  it("POSTs the new account as JSON and resolves with the created user", async () => {
    const requests = recordRequests();

    await expect(registerUser({ email: "new@example.com", password: "s3cretpass" })).resolves.toMatchObject({
      email: "new@example.com",
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]!.method).toBe("POST");
    expect(new URL(requests[0]!.url).pathname).toBe("/auth/register");
    expect(await requests[0]!.json()).toEqual({ email: "new@example.com", password: "s3cretpass" });
  });

  it("rejects with the server's message when the email is already taken", async () => {
    server.use(http.post("*/auth/register", () => HttpResponse.json({ error: { code: "EMAIL_TAKEN", message: "Email already registered" } }, { status: 409 })));

    await expect(registerUser({ email: "taken@example.com", password: "s3cretpass" })).rejects.toMatchObject({
      status: 409,
      message: "Email already registered",
    });
  });
});
