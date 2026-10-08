import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { Verifier } from "@pact-foundation/pact";
import { pactFilesFor } from "@platform/pact-config";
import type { Express } from "express";
import { afterAll, beforeAll, describe, it } from "vitest";
import { buildTestApp } from "../test-utils/build-test-app.js";
import { cookieNamed, loginVia, registerVia } from "../test-utils/session-helpers.js";

// Provider verification of auth-service (AICHAT-180): the real app (`createApp`) with the
// in-memory Prisma fake replays every interaction its consumers wrote (mfe-auth, shell,
// mfe-settings, mfe-chat). Each provider state builds a fresh app, so nothing leaks from one
// interaction to the next; states are set up through the public API, like a client would.

let current: Express = buildTestApp().app;
/** Cookie the next replayed request must carry, chosen by the provider state. */
let cookie: string | undefined;

function fresh(): Express {
  current = buildTestApp().app;
  cookie = undefined;
  return current;
}

async function loggedIn(email: string, password?: string): Promise<string[]> {
  const app = fresh();
  await registerVia(app, email, password);
  return loginVia(app, email, password);
}

const stateHandlers = {
  "no user is logged in": async () => {
    fresh();
  },
  "no user exists with the email": async () => {
    fresh();
  },
  "a user exists": async (params?: unknown) => {
    const { email, password } = params as { email: string; password: string };
    await registerVia(fresh(), email, password);
  },
  "a user is logged in": async (params?: unknown) => {
    const setCookie = await loggedIn((params as { email: string }).email);
    cookie = `${cookieNamed(setCookie, "access_token")}; ${cookieNamed(setCookie, "refresh_token")}`;
  },
  "a user has a valid refresh token": async (params?: unknown) => {
    const setCookie = await loggedIn((params as { email: string }).email);
    cookie = cookieNamed(setCookie, "refresh_token");
  },
};

describe("auth-service honours its consumers' pacts", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    // One listener for the whole run; it forwards to the app of the current provider state.
    const forward: RequestListener = (req, res) => current(req, res);
    server = createServer(forward);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it("verifies every interaction of every consumer", async () => {
    await new Verifier({
      provider: "auth-service",
      providerBaseUrl: baseUrl,
      pactUrls: pactFilesFor("auth-service"),
      stateHandlers,
      // Authentication is not part of the pacts: the state decides which cookie to send.
      requestFilter: (req, _res, next) => {
        if (cookie) req.headers["cookie"] = cookie;
        next();
      },
      logLevel: "warn",
    }).verifyProvider();
  });
});
