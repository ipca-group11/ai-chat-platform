import net from "node:net";

/**
 * A TCP proxy between the browser and the app that can drop the network (AICHAT-170).
 *
 * `context.setOffline(true)` only fails new requests: Chromium keeps an already open response
 * (the chat's SSE stream) flowing. A real network loss also kills the open connections, so tests
 * combine the two: `cutConnections()` destroys every socket through the proxy, and the offline
 * browser cannot open new ones until `setOffline(false)`.
 *
 * `setDown(true)` is an outage on the server side instead: the browser stays online, but every
 * connection is cut and new ones are refused until `setDown(false)`. The browser fires no `online`
 * event when it ends, so only the app's own reconnect logic can recover.
 */
export interface DropProxy {
  /** Origin to load the app from, e.g. `http://localhost:8100`. */
  url: string;
  /** Destroys every open connection (the browser sees a dropped connection). */
  cutConnections(): void;
  /** While down, open connections are cut and new ones are closed as soon as they arrive. */
  setDown(down: boolean): void;
  close(): Promise<void>;
}

export async function startDropProxy(target: URL, port = 0): Promise<DropProxy> {
  const sockets = new Set<net.Socket>();
  let down = false;
  const track = (socket: net.Socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    // A cut connection errors on both ends; that is the point, not a failure.
    socket.on("error", () => socket.destroy());
  };

  const server = net.createServer((client) => {
    if (down) {
      client.destroy();
      return;
    }
    const upstream = net.connect(Number(target.port), target.hostname);
    track(client);
    track(upstream);
    client.pipe(upstream);
    upstream.pipe(client);
    client.on("close", () => upstream.destroy());
    upstream.on("close", () => client.destroy());
  });

  // No host: listens on IPv4 and IPv6, so `localhost` works whichever one it resolves to.
  await new Promise<void>((resolve) => server.listen(port, resolve));
  const { port: listening } = server.address() as net.AddressInfo;

  return {
    url: `http://localhost:${listening}`,
    cutConnections: () => sockets.forEach((socket) => socket.destroy()),
    setDown: (value) => {
      down = value;
      if (down) sockets.forEach((socket) => socket.destroy());
    },
    close: () =>
      new Promise((resolve) => {
        sockets.forEach((socket) => socket.destroy());
        server.close(() => resolve());
      }),
  };
}
