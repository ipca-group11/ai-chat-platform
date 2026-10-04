import type { Express } from "express";

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
  name?: string;
  regexp?: RegExp & { fast_slash?: boolean };
  handle?: { stack?: Layer[] };
}

/** The mount path of a `router` layer, recovered from the regexp Express 4 builds for it
 * (`/^\/chats\/?(?=\/|$)/i` -> `/chats`). */
function mountPath(layer: Layer): string {
  if (!layer.regexp || layer.regexp.fast_slash) return "";
  return layer.regexp.source
    .replace(/^\^/, "")
    .replace(/\\\/\?\(\?=\\\/\|\$\)$/, "")
    .replace(/\\\//g, "/");
}

function walk(stack: Layer[], prefix: string, found: Set<string>): void {
  for (const layer of stack) {
    if (layer.route) {
      const path = `${prefix}${layer.route.path}`.replace(/(.)\/$/, "$1") || "/";
      for (const method of Object.keys(layer.route.methods)) {
        found.add(`${method.toUpperCase()} ${path}`);
      }
    } else if (layer.name === "router" && layer.handle?.stack) {
      walk(layer.handle.stack, `${prefix}${mountPath(layer)}`, found);
    }
  }
}

/** Every `METHOD /path` registered on an Express 4 app, mounted routers included,
 * sorted. Used by the route-inventory guard tests. */
export function listRoutes(app: Express): string[] {
  const router = (app as unknown as { _router?: { stack: Layer[] } })._router;
  const found = new Set<string>();
  walk(router?.stack ?? [], "", found);
  return [...found].sort();
}
