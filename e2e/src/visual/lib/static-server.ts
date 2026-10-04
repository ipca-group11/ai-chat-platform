import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { extname, join, normalize, sep } from "node:path";

/**
 * A tiny static file server for the production builds the visual tests look at (AICHAT-19).
 * `vite preview` would work as well, but it also proxies `/api` and `/auth` to a backend; here
 * every API call is answered by the tests, so a plain file server is all that is needed.
 *
 * Module Federation loads the remotes from other origins (ports), so every response carries
 * `Access-Control-Allow-Origin: *`. With `spa` set, unknown paths answer with `index.html` so
 * deep links such as `/chats/abc` work like they do behind the production proxy.
 */

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

export interface StaticServerOptions {
  /** Folder with the build output. */
  root: string;
  port: number;
  /** Answer unknown paths with `index.html` (the shell's client-side routes). */
  spa?: boolean;
}

/** Maps a URL path to a file inside `root`, or `undefined` when it would leave `root`. */
export function resolveFile(root: string, urlPath: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split("?")[0] ?? "/");
  } catch {
    return undefined;
  }
  const file = normalize(join(root, decoded));
  const inside = file === root || file.startsWith(root.endsWith(sep) ? root : root + sep);
  return inside ? file : undefined;
}

export function contentType(file: string): string {
  return TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
}

/** Starts the server on 127.0.0.1 and resolves once it listens. */
export function startStaticServer({ root, port, spa = false }: StaticServerOptions): Promise<Server> {
  const server = createServer((request, response) => {
    response.setHeader("Access-Control-Allow-Origin", "*");
    const target = resolveFile(root, request.url ?? "/");
    let file = target && existsSync(target) && statSync(target).isFile() ? target : undefined;
    if (!file && target && existsSync(target) && statSync(target).isDirectory()) {
      const index = join(target, "index.html");
      if (existsSync(index)) file = index;
    }
    if (!file && spa && target && extname(target) === "") file = join(root, "index.html");
    if (!file || !existsSync(file)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, { "Content-Type": contentType(file), "Cache-Control": "no-store" });
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

export function stopServer(server: Server): Promise<void> {
  return new Promise((resolve) => {
    server.close(() => resolve());
    server.closeAllConnections();
  });
}
