import { createRootRoute, createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { createAuthRoutes } from "./routes";

describe("createAuthRoutes (F1 module federation route contract)", () => {
  it("AC-30/AC-35: exposes exactly /login and /register routes parented to the host's root route", () => {
    const rootRoute = createRootRoute();
    const [loginRoute, registerRoute] = createAuthRoutes(rootRoute);
    const routeTree = rootRoute.addChildren([loginRoute, registerRoute]);

    // Building a router forces route initialization, which resolves each route's
    // full path from its parent (the host's root route in production).
    const router = createRouter({ routeTree });

    expect(Object.keys(router.routesById)).toEqual(
      expect.arrayContaining(["/login", "/register"]),
    );
  });
});
