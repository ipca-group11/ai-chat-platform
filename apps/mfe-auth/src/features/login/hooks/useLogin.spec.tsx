import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderHookWithClient } from "@platform/test-utils";
import { http, HttpResponse, server } from "@platform/test-utils/msw";
import { useLogin } from "./useLogin";

describe("useLogin", () => {
  it("starts idle and resolves with the user on success", async () => {
    const { result } = renderHookWithClient(() => useLogin());
    expect(result.current.isIdle).toBe(true);

    result.current.mutate({ email: "ana@example.com", password: "pw" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ email: "ana@example.com" });
  });

  it("surfaces a validation error returned by the server (400) with its message", async () => {
    server.use(http.post("*/auth/login", () => HttpResponse.json({ error: { code: "VALIDATION_ERROR", message: "Email is required" } }, { status: 400 })));
    const { result } = renderHookWithClient(() => useLogin());

    result.current.mutate({ email: "", password: "pw" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 400, message: "Email is required" });
  });

  it("surfaces wrong credentials (401) as an error", async () => {
    server.use(http.post("*/auth/login", () => HttpResponse.json({ error: { code: "UNAUTHENTICATED", message: "Invalid credentials" } }, { status: 401 })));
    const { result } = renderHookWithClient(() => useLogin());

    result.current.mutate({ email: "ana@example.com", password: "wrong" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 401, message: "Invalid credentials" });
  });

  it("surfaces a server error (500) as an error", async () => {
    server.use(http.post("*/auth/login", () => new HttpResponse(null, { status: 500, statusText: "Internal Server Error" })));
    const { result } = renderHookWithClient(() => useLogin());

    result.current.mutate({ email: "ana@example.com", password: "pw" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 500, message: "Internal Server Error" });
  });
});
