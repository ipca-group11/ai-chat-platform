import http from "node:http";
import type { AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";
import { startDropProxy, type DropProxy } from "./drop-proxy.js";

/**
 * The proxy behind the SSE reconnection tests (AICHAT-170). Node only, no browser: an HTTP server
 * that streams until the client goes away sits behind the proxy, and the tests check that the proxy
 * passes traffic through, cuts an open response, and refuses connections while it is down.
 */
let upstream: http.Server;
let proxy: DropProxy;

test.beforeEach(async () => {
  upstream = http.createServer((req, res) => {
    if (req.url === "/stream") {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write(": connected\n\n");
      return; // stays open until the client goes away
    }
    res.end("ok");
  });
  await new Promise<void>((resolve) => upstream.listen(0, resolve));
  proxy = await startDropProxy(new URL(`http://localhost:${(upstream.address() as AddressInfo).port}`));
});

test.afterEach(async () => {
  await proxy.close();
  await new Promise((resolve) => upstream.close(resolve));
});

/** Resolves with the response body, or with "failed" if the connection is refused or cut. */
function get(path: string): Promise<string> {
  return new Promise((resolve) => {
    http
      .get(`${proxy.url}${path}`, (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => (body += chunk.toString()));
        res.on("end", () => resolve(body));
        res.on("error", () => resolve("failed"));
      })
      .on("error", () => resolve("failed"));
  });
}

test("passes requests through to the app", async () => {
  expect(await get("/")).toBe("ok");
});

test("cutConnections ends an open stream, like a dropped network", async () => {
  const closed = new Promise<string>((resolve) => {
    http.get(`${proxy.url}/stream`, (res) => {
      res.once("data", () => proxy.cutConnections());
      res.on("close", () => resolve("closed"));
    });
  });

  expect(await closed).toBe("closed");
  expect(await get("/"), "new connections still work after a cut").toBe("ok");
});

test("setDown refuses new connections until it is up again", async () => {
  proxy.setDown(true);
  expect(await get("/")).toBe("failed");

  proxy.setDown(false);
  expect(await get("/")).toBe("ok");
});
