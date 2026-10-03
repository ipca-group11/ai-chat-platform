import { QueryClient, useQuery, useQueryClient } from "@tanstack/react-query";
import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { createTestQueryClient, renderHookWithClient, renderWithClient, withQueryClient } from "./render";

function RetryProbe() {
  const client = useQueryClient();
  const { retry } = client.getDefaultOptions().queries ?? {};
  return <p>retry: {String(retry)}</p>;
}

describe("createTestQueryClient", () => {
  it("turns retries off for queries and mutations", () => {
    const client = createTestQueryClient();

    expect(client.getDefaultOptions().queries?.retry).toBe(false);
    expect(client.getDefaultOptions().mutations?.retry).toBe(false);
  });

  it("returns a new client on every call", () => {
    expect(createTestQueryClient()).not.toBe(createTestQueryClient());
  });
});

describe("renderWithClient", () => {
  it("renders inside a QueryClientProvider and returns the client", () => {
    const { queryClient } = renderWithClient(<RetryProbe />);

    expect(screen.getByText("retry: false")).toBeInTheDocument();
    expect(queryClient).toBeInstanceOf(QueryClient);
  });

  it("uses the client it is given, so a test can seed the cache", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(["greeting"], "hello");
    function Greeting() {
      const { data } = useQuery({ queryKey: ["greeting"], queryFn: () => "from the network" });
      return <p>{data}</p>;
    }

    const result = renderWithClient(<Greeting />, { queryClient });

    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(result.queryClient).toBe(queryClient);
  });

  it("puts the extra wrapper inside the provider", () => {
    function Frame({ children }: { children: ReactNode }) {
      return <section aria-label="frame">{children}</section>;
    }

    renderWithClient(<RetryProbe />, { wrapper: Frame });

    expect(screen.getByLabelText("frame")).toContainElement(screen.getByText("retry: false"));
  });

  it("keeps the wrapper when the component is rendered again", () => {
    const { rerender } = renderWithClient(<RetryProbe />);

    rerender(<RetryProbe />);

    expect(screen.getByText("retry: false")).toBeInTheDocument();
  });
});

describe("renderHookWithClient", () => {
  it("runs the hook inside a QueryClientProvider", () => {
    const { result, queryClient } = renderHookWithClient(() => useQueryClient());

    expect(result.current).toBe(queryClient);
  });

  it("passes props and the extra wrapper to the hook", () => {
    const wrapper = ({ children }: { children: ReactNode }) => <div data-testid="inner">{children}</div>;

    const { result } = renderHookWithClient(({ n }: { n: number }) => n * 2, { initialProps: { n: 21 }, wrapper });

    expect(result.current).toBe(42);
  });
});

describe("withQueryClient", () => {
  it("builds a wrapper around the client it is given", () => {
    const client = createTestQueryClient();
    const wrapper = withQueryClient(client);

    const { result } = renderHookWithClient(() => useQueryClient(), { wrapper });

    expect(result.current).toBe(client);
  });
});
