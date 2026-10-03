import { waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderHookWithClient } from "@platform/test-utils";
import { http, HttpResponse, server } from "@platform/test-utils/msw";
import { useRegister } from "./useRegister";

describe("useRegister", () => {
  it("starts idle and resolves with the created user on success", async () => {
    const { result } = renderHookWithClient(() => useRegister());
    expect(result.current.isIdle).toBe(true);

    result.current.mutate({ email: "new@example.com", password: "s3cretpass" });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({ email: "new@example.com" });
  });

  it("surfaces a validation error returned by the server (400) with its message", async () => {
    server.use(
      http.post("*/auth/register", () =>
        HttpResponse.json({ message: "Password must contain at least one number" }, { status: 400 }),
      ),
    );
    const { result } = renderHookWithClient(() => useRegister());

    result.current.mutate({ email: "new@example.com", password: "onlyletters" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 400, message: "Password must contain at least one number" });
  });

  it("surfaces a duplicate email (409) as an error", async () => {
    server.use(http.post("*/auth/register", () => HttpResponse.json({ error: "Email already registered" }, { status: 409 })));
    const { result } = renderHookWithClient(() => useRegister());

    result.current.mutate({ email: "taken@example.com", password: "s3cretpass" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 409 });
  });

  it("surfaces a server error (500) as an error", async () => {
    server.use(http.post("*/auth/register", () => HttpResponse.json({ error: "Unexpected" }, { status: 500 })));
    const { result } = renderHookWithClient(() => useRegister());

    result.current.mutate({ email: "new@example.com", password: "s3cretpass" });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 500, message: "Unexpected" });
  });
});
