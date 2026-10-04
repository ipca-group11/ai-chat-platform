import { composeStories, type composeStory } from "@storybook/react-vite";
import { stableDom, waitForStableDom } from "@platform/test-utils/dom-snapshot";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * DOM snapshot of every story in this app (docs/AICHAT-20, component snapshots). Each story
 * runs as in Storybook, decorators, `beforeEach` and `play` included, until the DOM is quiet; the
 * whole body is stored so dialogs and toasts rendered in portals are part of the snapshot.
 */
type StoryFile = Parameters<typeof composeStories>[0];
type ComposedStory = ReturnType<typeof composeStory>;
const files = import.meta.glob<StoryFile>("./**/*.stories.tsx", { eager: true });

// A story waits for its own final state; page stories load whole remotes, slower on a busy machine.
const STORY_TIMEOUT_MS = 30_000;

// Only the clock is fake: timers stay real so `play` interactions and requests settle.
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-03T10:00:00.000Z"));
});
afterAll(() => vi.useRealTimers());

// Ids a component makes with Math.random (pending attachments, for example) repeat on every run:
// each story starts the same seeded sequence.
beforeEach(() => {
  let seed = 1;
  vi.spyOn(Math, "random").mockImplementation(() => (seed = (seed * 16807) % 2147483647) / 2147483647);
});
afterEach(() => vi.restoreAllMocks());

for (const [path, file] of Object.entries(files)) {
  describe(path, () => {
    for (const [name, Story] of Object.entries(composeStories(file) as Record<string, ComposedStory>)) {
      it(name, async () => {
        await Story.run();
        await waitForStableDom(document.body);
        expect(stableDom(document.body)).toMatchSnapshot();
      }, STORY_TIMEOUT_MS);
    }
  });
}
