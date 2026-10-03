import { LLM_API_KEY_HEADER } from "@app/shared-types/api-keys";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@platform/test-utils";
import { TestConnectionButton } from "./TestConnectionButton";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("TestConnectionButton", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("AC-85: is disabled when there is no key to test", () => {
    renderWithClient(
      <TestConnectionButton provider="openai" apiKey="" providerLabel="OpenAI" />,
    );

    expect(screen.getByRole("button", { name: /test openai connection/i })).toBeDisabled();
  });

  it("AC-85: sends the key once via header and shows a success toast", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: true }));
    const user = userEvent.setup();

    renderWithClient(
      <TestConnectionButton provider="openai" apiKey="sk-my-key" providerLabel="OpenAI" />,
    );

    await user.click(screen.getByRole("button", { name: /test openai connection/i }));

    await waitFor(() => expect(screen.getByText(/connection successful/i)).toBeInTheDocument());
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = new Headers(init?.headers);
    expect(headers.get(LLM_API_KEY_HEADER)).toBe("sk-my-key");
  });

  it("AC-85: shows a clear failure reason returned by the server", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ message: "Invalid API key" }, 401));
    const user = userEvent.setup();

    renderWithClient(
      <TestConnectionButton provider="anthropic" apiKey="bad-key" providerLabel="Anthropic" />,
    );

    await user.click(screen.getByRole("button", { name: /test anthropic connection/i }));

    await waitFor(() => expect(screen.getByText("Invalid API key")).toBeInTheDocument());
  });

  it("AC-85: shows a failure toast on a network error", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
    const user = userEvent.setup();

    renderWithClient(
      <TestConnectionButton provider="openai" apiKey="sk-my-key" providerLabel="OpenAI" />,
    );

    await user.click(screen.getByRole("button", { name: /test openai connection/i }));

    await waitFor(() => expect(screen.getByText(/network error/i)).toBeInTheDocument());
  });

  it("AC-85: shows a default failure message when the server doesn't provide one", async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ success: false }));
    const user = userEvent.setup();

    renderWithClient(
      <TestConnectionButton provider="openai" apiKey="sk-my-key" providerLabel="OpenAI" />,
    );

    await user.click(screen.getByRole("button", { name: /test openai connection/i }));

    await waitFor(() => expect(screen.getByText("Connection failed.")).toBeInTheDocument());
  });

  it("AC-85: shows 'Testing…' while the request is in flight", async () => {
    let resolveFetch: (response: Response) => void = () => {};
    vi.mocked(fetch).mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    const user = userEvent.setup();

    renderWithClient(
      <TestConnectionButton provider="openai" apiKey="sk-my-key" providerLabel="OpenAI" />,
    );

    await user.click(screen.getByRole("button", { name: /test openai connection/i }));

    expect(screen.getByRole("button", { name: "Testing…" })).toBeDisabled();
    resolveFetch(jsonResponse({ success: true }));
    await waitFor(() => expect(screen.getByText(/connection successful/i)).toBeInTheDocument());
  });

  it("shows a fallback toast if the mutation itself throws unexpectedly", async () => {
    vi.doMock("../api/testConnection", () => ({
      testConnection: vi.fn().mockRejectedValue(new Error("boom")),
    }));
    const { TestConnectionButton: PatchedButton } = await import("./TestConnectionButton");
    const user = userEvent.setup();

    renderWithClient(
      <PatchedButton provider="openai" apiKey="sk-my-key" providerLabel="OpenAI" />,
    );

    await user.click(screen.getByRole("button", { name: /test openai connection/i }));

    await waitFor(() =>
      expect(screen.getByText(/unable to test the connection/i)).toBeInTheDocument(),
    );

    vi.doUnmock("../api/testConnection");
    vi.resetModules();
  });
});
