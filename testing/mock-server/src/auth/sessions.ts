import type { Request } from "express";
import { auth } from "@app/shared-types";
import { parseCookies } from "../backend/http.js";
import type { MockUser } from "../data/types.js";
import type { MockContext } from "../registry.js";

/** Open sessions of the auth mock; the conversation mock reads the same ones. */
export class Sessions {
  private readonly byToken = new Map<string, string>();
  private counter = 0;

  constructor(private readonly nextRandom: () => number) {}

  open(userId: string): string {
    this.counter += 1;
    const token = `mock-session-${this.counter}-${Math.floor(this.nextRandom() * 0xffffffff).toString(36)}`;
    this.byToken.set(token, userId);
    return token;
  }

  userIdOf(token: string | undefined): string | undefined {
    return token ? this.byToken.get(token) : undefined;
  }

  close(token: string | undefined): void {
    if (token) this.byToken.delete(token);
  }

  clear(): void {
    this.byToken.clear();
    this.counter = 0;
  }
}

const registry = new WeakMap<MockContext, Sessions>();

/** The sessions of one mock server; cleared by `/__admin/reset`. */
export function sessionsFor(ctx: MockContext): Sessions {
  let sessions = registry.get(ctx);
  if (!sessions) {
    const created = new Sessions(() => ctx.rng.next());
    ctx.onReset(() => created.clear());
    registry.set(ctx, created);
    sessions = created;
  }
  return sessions;
}

/** Session token of a request: the access cookie, or a Bearer header like the real services accept. */
export function accessTokenOf(req: Request): string | undefined {
  const cookie = parseCookies(req.headers.cookie)[auth.ACCESS_TOKEN_COOKIE];
  if (cookie) return cookie;
  const header = req.headers.authorization;
  return header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;
}

/** The signed-in user of a request, or undefined when the session is missing, closed or unknown. */
export function currentUser(ctx: MockContext, req: Request): MockUser | undefined {
  const userId = sessionsFor(ctx).userIdOf(accessTokenOf(req));
  return userId ? ctx.store.data.users.find((user) => user.id === userId) : undefined;
}
