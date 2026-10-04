/**
 * Test-only style that keeps the anti-aliased corners of rounded elements the same on every run
 * (AICHAT-39). Without it, `chat-detail` came out in several variants that differ by one colour
 * level on a few corner pixels (the bot avatar, the "Reasoning on" button): 10 of 14 probes
 * matched with `rounded-full` elements on their own layer, 14 of 14 with every `rounded*` element
 * on its own layer through `will-change: transform` (unlike `transform`, it leaves the
 * positioning of dialogs alone). The app is not changed; the style is added in the visual tests only.
 */
export const STABLE_CSS = '[class*="rounded"] { will-change: transform; }';
