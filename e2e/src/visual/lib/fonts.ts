import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";

/**
 * Fonts without the network (AICHAT-39). `apps/shell/index.html` loads Inter and JetBrains Mono
 * from Google Fonts. In the visual tests those two requests are answered here: the stylesheet
 * with `@font-face` rules that point at local files, and the font files from `./fonts`. The app
 * itself is not changed (self-hosting the fonts is tracked in AICHAT-230).
 */

export const FONT_DIR = fileURLToPath(new URL("../fonts/", import.meta.url));

/** Where the fake stylesheet says the font files are; also answered by `installFonts`. */
export const FONT_ORIGIN = "https://fonts.gstatic.com/visual-tests";

export interface FontFace {
  family: string;
  file: string;
  weight: string;
}

export const FONT_FACES: readonly FontFace[] = [
  { family: "Inter", file: "inter-latin-wght-normal.woff2", weight: "100 900" },
  { family: "JetBrains Mono", file: "jetbrains-mono-latin-400-normal.woff2", weight: "400" },
  { family: "JetBrains Mono", file: "jetbrains-mono-latin-600-normal.woff2", weight: "600" },
];

export function fontCss(): string {
  return FONT_FACES.map(
    ({ family, file, weight }) =>
      `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(${FONT_ORIGIN}/${file}) format('woff2');}`,
  ).join("\n");
}

export async function installFonts(page: Page): Promise<void> {
  // Registered first: Playwright tries the routes of a page in reverse order, so the specific
  // handlers below win over this catch-all.
  await page.route("https://fonts.gstatic.com/**", (route) => route.abort());
  await page.route("https://fonts.googleapis.com/**", (route) =>
    route.fulfill({ status: 200, contentType: "text/css; charset=utf-8", body: fontCss() }),
  );
  await page.route(`${FONT_ORIGIN}/*`, (route) => {
    const name = new URL(route.request().url()).pathname.split("/").pop() ?? "";
    const face = FONT_FACES.find((f) => f.file === name);
    if (!face) return route.fulfill({ status: 404 });
    return route.fulfill({ status: 200, contentType: "font/woff2", body: readFileSync(`${FONT_DIR}${face.file}`) });
  });
}
