import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetShowReasoningForTests, useShowReasoning } from "./show-reasoning";

const KEY = "chat.showReasoning";

beforeEach(() => {
  window.localStorage.clear();
  __resetShowReasoningForTests();
});
afterEach(() => vi.restoreAllMocks());

describe("useShowReasoning", () => {
  it("shows reasoning by default", () => {
    const { result } = renderHook(() => useShowReasoning());

    expect(result.current[0]).toBe(true);
  });

  it("remembers the choice in localStorage", () => {
    const { result } = renderHook(() => useShowReasoning());

    act(() => result.current[1](false));

    expect(result.current[0]).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe("false");
  });

  it("restores a stored choice on first render", () => {
    window.localStorage.setItem(KEY, "false");

    const { result } = renderHook(() => useShowReasoning());

    expect(result.current[0]).toBe(false);
  });

  it("updates every open pane when one of them changes it", () => {
    const first = renderHook(() => useShowReasoning());
    const second = renderHook(() => useShowReasoning());

    act(() => first.result.current[1](false));

    expect(second.result.current[0]).toBe(false);
  });

  it("keeps the choice for the session when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useShowReasoning());
    expect(result.current[0]).toBe(true);

    act(() => result.current[1](false));

    expect(result.current[0]).toBe(false);
  });

  it("returns a stable setter", () => {
    const { result, rerender } = renderHook(() => useShowReasoning());
    const setter = result.current[1];

    rerender();

    expect(result.current[1]).toBe(setter);
  });
});
