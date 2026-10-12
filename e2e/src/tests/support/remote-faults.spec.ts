import { expect, test } from "@playwright/test";
import { matchesRemote, remoteNames, remotes } from "./remote-faults.js";

/**
 * The URL matcher behind `failRemote` (AICHAT-161). Node only, no browser. The old US-9 test blocked
 * `/remoteEntry|mfe-chat/i`, which matched the entry of every remote; these cases pin the fault to
 * one origin.
 */
const files = (origin: string) => [`${origin}/remoteEntry.js`, `${origin}/assets/routes-DqpX8igV.js`];

test.describe("matchesRemote", () => {
  for (const remote of remoteNames) {
    test(`${remote}: matches its own entry and chunks, and no file of the other remotes`, () => {
      const { origin } = remotes[remote];
      for (const url of files(origin)) expect(matchesRemote(url, origin), url).toBe(true);

      for (const other of remoteNames.filter((name) => name !== remote)) {
        for (const url of files(remotes[other].origin)) expect(matchesRemote(url, origin), url).toBe(false);
      }
    });
  }

  test("leaves the shell and the APIs alone, even on the same host", () => {
    const origin = "http://localhost:3002";
    for (const url of [
      "http://localhost:8000/remoteEntry.js",
      "http://localhost:8000/api/chats",
      "http://localhost:4001/auth/me",
    ]) {
      expect(matchesRemote(url, origin), url).toBe(false);
    }
  });

  test("compares origins, not text: scheme and host must match too", () => {
    const origin = "http://localhost:3002";
    expect(matchesRemote("https://localhost:3002/remoteEntry.js", origin)).toBe(false);
    expect(matchesRemote("http://127.0.0.1:3002/remoteEntry.js", origin)).toBe(false);
    expect(matchesRemote("http://localhost:3002/remoteEntry.js", "http://localhost:3002/")).toBe(true);
  });

  test("files 'chunks' lets remoteEntry.js through and matches everything else", () => {
    const origin = "http://localhost:3002";
    expect(matchesRemote(`${origin}/remoteEntry.js`, origin, "chunks")).toBe(false);
    expect(matchesRemote(`${origin}/remoteEntry.js?v=2`, origin, "chunks")).toBe(false);
    expect(matchesRemote(`${origin}/assets/routes-DqpX8igV.js`, origin, "chunks")).toBe(true);
  });
});
