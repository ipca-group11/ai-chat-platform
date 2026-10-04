import { LLM_API_KEY_HEADER } from "@app/shared-types/api-keys";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithClient } from "@platform/test-utils";
import { http, HttpResponse, recordRequests, server } from "@platform/test-utils/msw";
import { TestConnectionButton } from "./TestConnectionButton";

const respondWith = (response: () => Response | Promise<Response>) =>
  server.use(http.post("*/providers/:provider/test-connection", response));

describe("TestConnectionButton", () => {
  it("AC-85: is disabled when there is no key to test", () => {
    renderWithClient(
      <TestConnectionButton provider="openai" apiKey="" providerLabel="OpenAI" />,
    );

    expect(screen.getByRole("button", { name: /test openai connection/i })).toBeDisabled();
  });

  it("AC-85: sends the key once via header and shows a success toast", async () => {
    const requests = recordRequests();
    const user = userEvent.setup();

    renderWithClient(
      <TestConnectionButton provider="openai" apiKey="sk-my-key" providerLabel="OpenAI" />,
    );

    await user.click(screen.getByRole("button", { name: /test openai connection/i }));

    await waitFor(() => expect(screen.getByText(/connection successful/i)).toBeInTheDocument());
    expect(requests[0]!.headers.get(LLM_API_KEY_HEADER)).toBe("sk-my-key");
  });

  it("AC-85: shows a clear failure reason returned by the server", async () => {
    respondWith(() => HttpResponse.json({ message: "Invalid API key" }, { status: 401 }));
    const user = userEvent.setup();

    renderWithClient(
      <TestConnectionButton provider="anthropic" apiKey="bad-key" providerLabel="Anthropic" />,
    );

    await user.click(screen.getByRole("button", { name: /test anthropic connection/i }));

    await waitFor(() => expect(screen.getByText("Invalid API key")).toBeInTheDocument());
  });

  it("AC-85: shows a failure toast on a network error", async () => {
    respondWith(() => HttpResponse.error());
    const user = userEvent.setup();

    renderWithClient(
      <TestConnectionButton provider="openai" apiKey="sk-my-key" providerLabel="OpenAI" />,
    );

    await user.click(screen.getByRole("button", { name: /test openai connection/i }));

    await waitFor(() => expect(screen.getByText(/network error/i)).toBeInTheDocument());
  });

  it("AC-85: shows a default failure message when the server doesn't provide one", async () => {
    respondWith(() => HttpResponse.json({ success: false }));
    const user = userEvent.setup();

    renderWithClient(
      <TestConnectionButton provider="openai" apiKey="sk-my-key" providerLabel="OpenAI" />,
    );

    await user.click(screen.getByRole("button", { name: /test openai connection/i }));

    await waitFor(() => expect(screen.getByText("Connection failed.")).toBeInTheDocument());
  });

  it("AC-85: shows 'Testing…' while the request is in flight", async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    respondWith(async () => {
      await gate;
      return HttpResponse.json({ success: true });
    });
    const user = userEvent.setup();

    renderWithClient(
      <TestConnectionButton provider="openai" apiKey="sk-my-key" providerLabel="OpenAI" />,
    );

    await user.click(screen.getByRole("button", { name: /test openai connection/i }));

    expect(screen.getByRole("button", { name: "Testing…" })).toBeDisabled();
    release();
    await waitFor(() => expect(screen.getByText(/connection successful/i)).toBeInTheDocument());
  });

  it("shows a fallback toast if the mutation itself throws unexpectedly", async () => {
    // The one case MSW cannot produce: fetch resolves with something that is not a Response, so the
    // code after the network call throws. A one-off spy keeps every other request on the MSW server.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(undefined as unknown as Response);
    const user = userEvent.setup();

    renderWithClient(
      <TestConnectionButton provider="openai" apiKey="sk-my-key" providerLabel="OpenAI" />,
    );

    await user.click(screen.getByRole("button", { name: /test openai connection/i }));

    await waitFor(() =>
      expect(screen.getByText(/unable to test the connection/i)).toBeInTheDocument(),
    );
    fetchSpy.mockRestore();
  });
});
