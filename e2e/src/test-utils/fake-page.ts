import type { Page } from "@playwright/test";

const show = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) => (v instanceof RegExp ? String(v) : v));

class FakeLocator {
  constructor(
    private readonly calls: string[],
    private readonly path: string,
  ) {}

  private child(method: string, args: unknown[]): FakeLocator {
    return new FakeLocator(this.calls, `${this.path}${this.path ? "." : ""}${method}(${args.map(show).join(", ")})`);
  }

  private act(method: string, args: unknown[]): Promise<void> {
    this.calls.push(`${this.path}.${method}(${args.map(show).join(", ")})`);
    return Promise.resolve();
  }

  getByRole(...args: unknown[]) {
    return this.child("getByRole", args);
  }
  getByLabel(...args: unknown[]) {
    return this.child("getByLabel", args);
  }
  locator(...args: unknown[]) {
    return this.child("locator", args);
  }
  last() {
    return this.child("last", []);
  }
  fill(...args: unknown[]) {
    return this.act("fill", args);
  }
  click(...args: unknown[]) {
    return this.act("click", args);
  }
  selectOption(...args: unknown[]) {
    return this.act("selectOption", args);
  }
  setInputFiles(...args: unknown[]) {
    return this.act("setInputFiles", args);
  }
}

/**
 * A recording stand-in for a Playwright `Page`: every locator chain and action is appended
 * to `calls` as text, e.g. `getByLabel("Email").fill("a@b.pt")`. Lets the flow helpers be
 * unit-tested without a browser.
 */
export function createFakePage(currentUrl = "http://localhost/") {
  const calls: string[] = [];
  const root = new FakeLocator(calls, "");
  const state = { url: currentUrl };

  const page = {
    goto: (url: string) => {
      calls.push(`goto(${show(url)})`);
      return Promise.resolve();
    },
    waitForURL: (pattern: unknown) => {
      calls.push(`waitForURL(${show(pattern)})`);
      return Promise.resolve();
    },
    url: () => state.url,
    getByRole: (...args: unknown[]) => root.getByRole(...args),
    getByLabel: (...args: unknown[]) => root.getByLabel(...args),
    locator: (...args: unknown[]) => root.locator(...args),
  };

  return { page: page as unknown as Page, calls, state };
}
