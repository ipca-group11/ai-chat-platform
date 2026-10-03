import { screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderWithQueryClient } from "./shared/test/render";
import App from "./app";
import routesDefault from "./routes";

const useCurrentUserIdMock = vi.fn();

vi.mock("./features/api-keys/hooks/useCurrentUserId", () => ({
  useCurrentUserId: () => useCurrentUserIdMock(),
}));

describe("App (/settings page)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useCurrentUserIdMock.mockReturnValue({ userId: "user-1", isLoading: false, isError: false });
  });

  it("AC-75: renders the configuration page content so /settings is routable", () => {
    renderWithQueryClient(<App />);

    expect(screen.getByRole("heading", { name: /llm provider api keys/i })).toBeInTheDocument();
    expect(screen.getByLabelText("LLM provider API keys")).toBeInTheDocument();
    expect(screen.getByLabelText("OpenAI API key")).toBeInTheDocument();
  });

  it("AC-75: the `./routes` module federation entry point default-exports the same page component", () => {
    expect(routesDefault).toBe(App);
  });
});
