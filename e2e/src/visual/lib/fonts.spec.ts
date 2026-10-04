import { existsSync, readFileSync } from "node:fs";
import type { Page, Route } from "@playwright/test";
import { describe, expect, it } from "vitest";
import { FONT_DIR, FONT_FACES, FONT_ORIGIN, fontCss, installFonts } from "./fonts.js";

type Handler = (route: Route) => unknown;

/** A page that only remembers the routes registered on it. */
function recordingPage() {
  const routes: { pattern: string; handler: Handler }[] = [];
  const page = {
    route: (pattern: string, handler: Handler) => {
      routes.push({ pattern, handler });
      return Promise.resolve();
    },
  } as unknown as Page;
  return { page, routes };
}

/** A route that records what it was answered with. */
function fakeRoute(url: string) {
  const result: { fulfilled?: { status: number; body?: unknown; contentType?: string }; aborted?: boolean } = {};
  const route = {
    request: () => ({ url: () => url }),
    fulfill: (options: { status: number; body?: unknown; contentType?: string }) => {
      result.fulfilled = options;
      return Promise.resolve();
    },
    abort: () => {
      result.aborted = true;
      return Promise.resolve();
    },
  } as unknown as Route;
  return { route, result };
}

describe("fonts without the network", () => {
  it("ships every font file named in the stylesheet, and the licence", () => {
    for (const face of FONT_FACES) expect(existsSync(`${FONT_DIR}${face.file}`), face.file).toBe(true);
    expect(readFileSync(`${FONT_DIR}OFL.txt`, "utf-8")).toContain("SIL Open Font License");
  });

  it("writes one @font-face per file for the families the shell asks for", () => {
    const css = fontCss();
    expect(css.match(/@font-face/g)).toHaveLength(FONT_FACES.length);
    expect(css).toContain("font-family:'Inter'");
    expect(css).toContain("font-family:'JetBrains Mono'");
    expect(css).toContain(`url(${FONT_ORIGIN}/inter-latin-wght-normal.woff2)`);
  });

  it("answers the stylesheet and the font files locally, and blocks the rest of the font hosts", async () => {
    const { page, routes } = recordingPage();
    await installFonts(page);
    const find = (url: string) => routes.filter((r) => r.pattern === url);

    const stylesheet = fakeRoute("https://fonts.googleapis.com/css2?family=Inter");
    await find("https://fonts.googleapis.com/**")[0]?.handler(stylesheet.route);
    expect(stylesheet.result.fulfilled?.contentType).toContain("text/css");
    expect(String(stylesheet.result.fulfilled?.body)).toContain("@font-face");

    const file = fakeRoute(`${FONT_ORIGIN}/jetbrains-mono-latin-400-normal.woff2`);
    await find(`${FONT_ORIGIN}/*`)[0]?.handler(file.route);
    expect(file.result.fulfilled?.contentType).toBe("font/woff2");
    expect(Buffer.isBuffer(file.result.fulfilled?.body)).toBe(true);

    const unknown = fakeRoute(`${FONT_ORIGIN}/nope.woff2`);
    await find(`${FONT_ORIGIN}/*`)[0]?.handler(unknown.route);
    expect(unknown.result.fulfilled?.status).toBe(404);

    const hint = fakeRoute("https://fonts.gstatic.com/s/other.woff2");
    await find("https://fonts.gstatic.com/**")[0]?.handler(hint.route);
    expect(hint.result.aborted).toBe(true);
    // The catch-all is registered first, so the specific routes (registered later) win.
    expect(routes[0]?.pattern).toBe("https://fonts.gstatic.com/**");
  });
});
