---
title: "AICHAT-19 · Visual regression testing: running and updating the baselines"
---

# Visual regression: running and updating the baselines

The `visual` Playwright project takes a screenshot of nine key screens, each in light and dark theme (18 images), and compares them with the baselines committed in `e2e/src/visual/__screenshots__/visual/`. This page says how to run the comparison, how to update the baselines when the UI changes on purpose, and what to check before you commit new images.

## Rules

1. **Baselines come from the Playwright Docker image only.** Fonts and anti-aliasing differ between macOS, Windows and Linux, so an image made on your machine will not match the one made in CI. The image tag is the installed `@playwright/test` version: `mcr.microsoft.com/playwright:v1.63.0-noble`. When you upgrade `@playwright/test`, change the tag in `e2e/package.json` (the structural test `e2e/src/ci/visual-workflow.spec.ts` fails if they differ) and regenerate all baselines in the same pull request.
2. **Only the `visual` project runs.** The full e2e suite is disabled (too slow); `pnpm --filter e2e run e2e` runs the `chromium` project and never the visual specs.
3. **No backend is needed.** The tests serve the production builds of the shell and the three remotes on ports 5000 to 5003 inside the container, answer every API call with fixed JSON, freeze the clock at 2026-03-10 10:00 UTC and load Inter and JetBrains Mono from `e2e/src/visual/fonts/` instead of Google Fonts.

## Run the comparison

```sh
pnpm exec nx run-many -t build -p shell mfe-auth mfe-chat mfe-settings   # the tests look at apps/*/dist
pnpm --filter e2e run visual                                              # docker run ... playwright test --project=visual
```

It takes about 30 seconds after the image is pulled (first run: about 2 GB). Exit code 0 means every screen matches. A difference fails the run and writes three files per failed screen to `e2e/test-results/<test>/`: `*-expected.png`, `*-actual.png` and `*-diff.png` (changed pixels in red).

The tolerance is set in `e2e/playwright.config.ts`: at most 50 pixels may differ (`maxDiffPixels: 50`) and each pixel is compared with `threshold: 0.2`. Animations are disabled and the caret is hidden. The limit is tight on purpose: the images are the same from run to run, and a changed heading differs by about 650 pixels.

## Update the baselines (the UI changed on purpose)

```sh
pnpm exec nx run-many -t build -p shell mfe-auth mfe-chat mfe-settings
pnpm --filter e2e run visual:update       # same Docker command with --update-snapshots
git status e2e/src/visual/__screenshots__ # only the screens you meant to change may be listed
```

To update a single screen, add a filter: `pnpm --filter e2e run visual:update -g "chat-detail"`.

Commit the new PNGs in the same pull request as the UI change, in their own commit (for example `test(visual): update the chat detail baselines`), so the images can be reviewed apart from the code.

## Review checklist for changed baselines

Open the changed PNGs in the pull request diff (GitHub shows them side by side; use the "2-up", "swipe" or "onion skin" view) and check each point:

- [ ] Every changed image belongs to the screen the pull request is about. A change in an unrelated screen is a bug or a shared component that changed; find out which.
- [ ] Both themes were updated. If only the light image changed, check the dark one (and the other way round).
- [ ] The change is the one the pull request describes: text, spacing, colour, icon. Nothing else moved (layout shift, a missing element, a cropped panel).
- [ ] No error text, empty state or loading skeleton appears where it should not; the screenshot is taken after the screen is complete.
- [ ] Text is readable and contrast is fine in both themes.
- [ ] No data from a real person or real service: only the fixed test data (`ana.silva@example.com`, "Trip planning for Lisbon", ...).
- [ ] The images were made in the Docker image (`visual:update`), not with a local `playwright test --update-snapshots`. If unsure, run `pnpm --filter e2e run visual` once more on a clean checkout: it must pass without changes.
- [ ] The number of files matches: 18 baselines, no leftover `-actual` or `-diff` file committed.

## When CI fails on a diff

The workflow `.github/workflows/visual.yml` runs on pull requests to `integration/testing-epics` and `main` that touch `apps/**`, `packages/ui/**` or `e2e/src/visual/**`, and can be started by hand from the Actions tab. If a screen differs, the job `visual / screenshots` is red and the artifact `visual-diff` (14 days) holds the contents of `e2e/test-results/`.

1. Download `visual-diff` and open the `*-diff.png` of the failed screens.
2. Unwanted change: fix the code and push again.
3. Wanted change: update the baselines as above and push the new images.
4. The same screen fails on every run with a tiny difference: check that the baseline was made in the Docker image and that the image tag still matches `@playwright/test`.

Branch protection is not available on this private repository, so "do not merge while `visual / screenshots` is red" is a team rule.

## Known limit: processor type

The 18 baselines were made in the arm64 image on an Apple silicon machine; GitHub runners use the amd64 image. Text and shapes should come out the same (software rendering, no font hinting, sub-pixel differences stay under the per-pixel `threshold`), but this was not checked on amd64, because the amd64 image is too slow under emulation on a Mac. If the first run on GitHub fails on many screens with small diffs, take the `*-actual.png` files from the `visual-diff` artifact as the new baselines, or add `--platform linux/amd64` to both Docker commands in `e2e/package.json` and regenerate on an amd64 machine.

## Check that the screenshots are deterministic

```sh
node scripts/visual/determinism.ts 10
```

Runs the comparison ten times, rewriting every baseline each time, and checks that no image differs from the committed one, byte for byte.

## Add a screen

1. Add an entry to `SCREENS` in `e2e/src/visual/screens.spec.ts` (route, API scenario from `lib/mock-api.ts`, and a `ready` step that waits for the finished screen).
2. If the screen needs other data, add it to `lib/data.ts` and to `answer` in `lib/mock-api.ts`; a call nobody mocked fails the test with `API calls nobody mocked`.
3. Run `visual:update -g "<screen name>"`, review the two new images with the checklist above and commit them.
