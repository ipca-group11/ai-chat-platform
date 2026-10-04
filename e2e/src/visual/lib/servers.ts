import type { Server } from "node:http";
import { fileURLToPath } from "node:url";
import { startStaticServer, stopServer } from "./static-server.js";

/**
 * The production builds the visual tests serve (AICHAT-39). The ports are the ones the shell
 * has baked in for its remotes (`apps/shell/module-federation.config.ts`: 5001 auth, 5002 chat,
 * 5003 settings), so no environment variable is needed at build time.
 */
export const APPS = [
  { name: "shell", port: 5000, spa: true },
  { name: "mfe-auth", port: 5001, spa: false },
  { name: "mfe-chat", port: 5002, spa: false },
  { name: "mfe-settings", port: 5003, spa: false },
] as const;

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

export const distDir = (name: string): string => `${repoRoot}apps/${name}/dist`;

export async function startApps(): Promise<Server[]> {
  return Promise.all(APPS.map((app) => startStaticServer({ root: distDir(app.name), port: app.port, spa: app.spa })));
}

export async function stopApps(servers: Server[]): Promise<void> {
  await Promise.all(servers.map(stopServer));
}
