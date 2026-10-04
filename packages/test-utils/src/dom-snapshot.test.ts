import { describe, expect, it } from "vitest";
import { stableDom, waitForStableDom } from "./dom-snapshot";

function html(markup: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = markup;
  return root;
}

describe("stableDom", () => {
  it("renumbers React ids in order of appearance, keeping references between elements", () => {
    const out = stableDom(html('<label for="base-ui-_r_1f_" id="_r_7_">A</label><input id="base-ui-_r_1f_" aria-labelledby="_r_7_">'));
    expect(out.innerHTML).toBe('<label for="base-ui-_r_0_" id="_r_1_">A</label><input id="base-ui-_r_0_" aria-labelledby="_r_1_">');
  });

  it("gives the same output whatever the counter was when the tree rendered", () => {
    expect(stableDom(html('<p id="«r3»"></p>')).innerHTML).toBe(stableDom(html('<p id=":r9z:"></p>')).innerHTML);
  });

  it("replaces UUIDs and ISO dates in attributes and text", () => {
    const out = stableDom(
      html('<a href="/chats/7d9e1f2a-3b4c-4d5e-8f60-718293a4b5c6">sent 2026-10-03T09:16:00.000Z</a>'),
    );
    expect(out.innerHTML).toBe('<a href="/chats/<uuid>">sent &lt;date&gt;</a>');
  });

  it("leaves the rendered tree untouched", () => {
    const root = html('<p id="_r_5_">x</p>');
    stableDom(root);
    expect(root.innerHTML).toBe('<p id="_r_5_">x</p>');
  });

  it("works on a whole document body", () => {
    document.body.innerHTML = '<div id="_r_2_"></div>';
    expect(stableDom(document.body).innerHTML).toBe('<div id="_r_0_"></div>');
    document.body.innerHTML = "";
  });
});

describe("waitForStableDom", () => {
  it("waits for a change that lands a few ticks after the call", async () => {
    const root = document.createElement("div");
    root.textContent = "Loading";
    setTimeout(() => (root.textContent = "Loaded"), 30);
    await waitForStableDom(root);
    expect(root.textContent).toBe("Loaded");
  });

  it("returns soon when nothing changes", async () => {
    const start = performance.now();
    await waitForStableDom(document.createElement("div"), { quietMs: 20 });
    expect(performance.now() - start).toBeLessThan(500);
  });

  it("gives up after the timeout when the DOM keeps changing", async () => {
    const root = document.createElement("div");
    const timer = setInterval(() => (root.textContent = String(performance.now())), 5);
    const start = performance.now();
    await waitForStableDom(root, { quietMs: 50, timeoutMs: 100 });
    clearInterval(timer);
    expect(performance.now() - start).toBeGreaterThanOrEqual(100);
  });
});
