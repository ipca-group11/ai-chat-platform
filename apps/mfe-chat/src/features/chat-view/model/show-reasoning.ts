import { useCallback, useSyncExternalStore } from "react";

/**
 * Per-browser preference for showing the model's reasoning under assistant replies.
 * Shared by every open chat pane (they all re-render when it changes) and remembered
 * across reloads. On by default; storage can be unavailable (private mode, blocked
 * site data), in which case the setting just lasts for the session.
 */
const STORAGE_KEY = "chat.showReasoning";
const listeners = new Set<() => void>();
let fallback = true;

function read(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === null ? fallback : stored === "true";
  } catch {
    return fallback;
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useShowReasoning(): [boolean, (next: boolean) => void] {
  const show = useSyncExternalStore(subscribe, read, () => true);
  const setShow = useCallback((next: boolean) => {
    fallback = next;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      // Kept in memory only (see above).
    }
    listeners.forEach((listener) => listener());
  }, []);
  return [show, setShow];
}

/** Test-only: forgets the in-memory value between test cases. */
export function __resetShowReasoningForTests(): void {
  fallback = true;
}
