/**
 * Test-only style that keeps the anti-aliased edges of round elements the same on every run
 * (AICHAT-39). Without it, the bot avatar of `chat-detail` (a `rounded-full` span with a border)
 * came out in two variants (4 and 8 of 12 probes) that differ by one colour level on about 20 edge
 * pixels. Giving round elements their own compositing layer made 12 of 12 probes
 * identical. The app is not changed; the style is added in the visual tests only.
 */
export const STABLE_CSS = ".rounded-full { transform: translateZ(0); }";
