import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { APPS, distDir } from "./servers.js";

const repoFile = (path: string): string => readFileSync(fileURLToPath(new URL(`../../../../${path}`, import.meta.url)), "utf-8");

describe("apps served for the visual tests", () => {
  it("uses the ports the shell has baked in for its remotes", () => {
    const config = repoFile("apps/shell/module-federation.config.ts");
    const port = (name: string): number => Number(new RegExp(`${name}\\s*=[^;]*'http://localhost:(\\d+)'`).exec(config)?.[1]);
    const byName = Object.fromEntries(APPS.map((app) => [app.name, app.port]));
    expect(byName["mfe-auth"]).toBe(port("authRemoteUrl"));
    expect(byName["mfe-chat"]).toBe(port("chatRemoteUrl"));
    expect(byName["mfe-settings"]).toBe(port("settingsRemoteUrl"));
    expect(byName["shell"]).toBe(5000);
  });

  it("serves only the shell as a single-page app and reads the build output of each app", () => {
    expect(APPS.filter((app) => app.spa).map((app) => app.name)).toEqual(["shell"]);
    expect(distDir("shell")).toMatch(/\/apps\/shell\/dist$/);
  });
});
