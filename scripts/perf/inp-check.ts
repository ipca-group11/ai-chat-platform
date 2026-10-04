#!/usr/bin/env node
// INP check for CI (AICHAT-240). Lighthouse's TBT is 0 ms on every page, so the lab budget cannot see a slow click or
// keystroke. This script opens the pages in headless Chrome with a throttled CPU, plays a short scripted user session
// on each (open and close the new-chat dialog, type in the composer, open the members dialog, ...), records how long
// each interaction takes to its next frame and computes INP from them like web-vitals does. The median of the runs of each page is asserted
// against the 200 ms budget (docs/AICHAT-21 US1); exit code 1 when a page is over it or a scenario finds no control.
//   bash testing/lighthouse/inp.sh               # against the stack of `pnpm mock:up`
// Variables: INP_PASSWORD (required; inp.sh sets it), INP_BASE_URL (http://localhost:8000), INP_EMAIL, INP_RUNS (3),
// INP_CPU_THROTTLE (4), INP_BUDGET_MS (200), LH_RESULTS (lighthouse-results), CHROME_PATH.
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';
import type { Page } from 'puppeteer-core';
import { signInSeededUser } from '../dast/zap-session.ts';
import { chromeCandidates } from './field-pages.ts';
import { INP_BUDGET_MS, inpOf, interactionCount, renderMarkdown, summarise } from './inp.ts';
import type { EventEntry, InpRun } from './inp.ts';

const base = (process.env['INP_BASE_URL'] ?? 'http://localhost:8000').replace(/\/$/, '');
const email = process.env['INP_EMAIL'] ?? 'inp-user@inp.example.com';
// No literal fallback here (a secret must not have a default in code); testing/lighthouse/inp.sh sets the password.
const password = process.env['INP_PASSWORD'];
if (!password) throw new Error('INP_PASSWORD is not set (testing/lighthouse/inp.sh sets it for the local stack)');
const runs = Number(process.env['INP_RUNS'] ?? 3);
const cpuThrottle = Number(process.env['INP_CPU_THROTTLE'] ?? 4);
const budget = Number(process.env['INP_BUDGET_MS'] ?? INP_BUDGET_MS);
const results = process.env['LH_RESULTS'] ?? 'lighthouse-results';

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Clicks the element with this accessible role and name, then lets the page paint. */
async function click(page: Page, role: string, name: string): Promise<void> {
  await page.locator(`::-p-aria([role="${role}"][name="${name}"])`).setTimeout(10_000).click();
  await pause(400);
}

async function press(page: Page, key: 'Escape' | 'Tab'): Promise<void> {
  await page.keyboard.press(key);
  await pause(400);
}

/**
 * Waits until the page has settled: no long task and no new largest-contentful-paint candidate for 1.5 s (at most
 * 20 s). An interaction made while the page still boots waits for the first frames with content, which measures
 * the load (Lighthouse's job), not how the page answers the user.
 */
async function waitForQuiet(page: Page): Promise<void> {
  for (let i = 0; i < 80; i += 1) {
    const quietFor = (await page.evaluate('performance.now() - window.__lastActivity')) as number;
    if (quietFor >= 1500) return;
    await pause(250);
  }
}

interface Scenario {
  page: string;
  path: (chatId: string) => string;
  signedIn: boolean;
  play: (page: Page) => Promise<void>;
}

/** The scripted sessions. Each one uses controls that are on the page for every user; keep them short and stable. */
const scenarios: Scenario[] = [
  {
    page: '/login',
    path: () => '/login',
    signedIn: false,
    play: async (page) => {
      await click(page, 'textbox', 'Email');
      await page.keyboard.type('someone@example.com', { delay: 40 });
      await press(page, 'Tab');
      await page.keyboard.type('not-a-password', { delay: 40 });
    },
  },
  {
    page: '/chats',
    path: () => '/chats',
    signedIn: true,
    play: async (page) => {
      for (let i = 0; i < 2; i += 1) {
        await click(page, 'button', 'New chat');
        await press(page, 'Escape');
      }
    },
  },
  {
    page: '/chats/:id',
    path: (chatId) => `/chats/${chatId}`,
    signedIn: true,
    play: async (page) => {
      await click(page, 'textbox', 'Message');
      await page.keyboard.type('How long does this take to render?', { delay: 40 });
      await click(page, 'button', 'Share chat');
      await press(page, 'Escape');
      await click(page, 'button', 'New chat');
      await press(page, 'Escape');
    },
  },
];

const cookieHeader = await signInSeededUser(base, email, password, 1);
const accessToken = cookieHeader.split('; ').find((pair) => pair.startsWith('access_token='))?.slice('access_token='.length);
if (!accessToken) throw new Error('the seeded user has no access token cookie');
const chats = (await (await fetch(`${base}/api/chats`, { headers: { Cookie: cookieHeader } })).json()) as { chats: { id: string }[] };
const chatId = chats.chats[0]?.id;
if (!chatId) throw new Error('the seeded user has no chat');

const executablePath = chromeCandidates(process.env).find((path) => existsSync(path));
if (!executablePath) throw new Error('no Chrome found: set CHROME_PATH');
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
const measured: InpRun[] = [];
try {
  for (let run = 1; run <= runs; run += 1) {
    for (const scenario of scenarios) {
      // A fresh context per visit: no cache, no state left by the previous page.
      const context = await browser.createBrowserContext();
      const page = await context.newPage();
      await page.setViewport({ width: 1350, height: 940 });
      if (cpuThrottle !== 1) {
        const cdp = await page.createCDPSession();
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
      }
      // Records, for every discrete input event, the time from the event to the end of the next frame (the event's own
      // timestamp to a double requestAnimationFrame, which includes input delay, handlers and the frame's style, layout
      // and paint work on the main thread). A pointerdown or keydown starts an interaction; the pointerup, click and
      // keyup after it belong to it, like the interactionId of Event Timing. Event Timing itself is not used: headless
      // Chrome reports its "next paint" only when it next presents a frame, which can be seconds later on a page that
      // keeps rendering, so its durations measure the headless compositor rather than the page.
      // Also tracks when the page last had a long task or a new largest paint (see waitForQuiet).
      await page.evaluateOnNewDocument(`
        window.__inpEntries = [];
        window.__lastActivity = 0;
        for (const type of ['longtask', 'largest-contentful-paint']) {
          new PerformanceObserver((list) => {
            for (const e of list.getEntries()) window.__lastActivity = Math.max(window.__lastActivity, e.startTime + e.duration);
          }).observe({ type, buffered: true });
        }
        let interactionId = 0;
        for (const name of ['pointerdown', 'pointerup', 'click', 'keydown', 'keyup']) {
          addEventListener(name, (event) => {
            if (name === 'pointerdown' || name === 'keydown') interactionId += 1;
            const entry = { name, interactionId, duration: 0, target: '' };
            const t = event.target;
            if (t && t.tagName) entry.target = t.tagName.toLowerCase() + (t.getAttribute('aria-label') ? '[' + t.getAttribute('aria-label') + ']' : '');
            window.__inpEntries.push(entry);
            requestAnimationFrame(() => requestAnimationFrame(() => { entry.duration = performance.now() - event.timeStamp; }));
          }, { capture: true });
        }
      `);
      if (scenario.signedIn) await page.setCookie({ name: 'access_token', value: accessToken, url: base, httpOnly: true });
      await page.goto(`${base}${scenario.path(chatId)}`, { waitUntil: 'load' });
      try {
        await waitForQuiet(page);
        await scenario.play(page);
      } catch (error) {
        console.error(`${scenario.page}: the scenario failed (${(error as Error).message})`);
      }
      // The last entries get their duration after the next frames; give them a moment.
      await pause(1000);
      const entries = (await page.evaluate('window.__inpEntries')) as EventEntry[];
      const interactions = interactionCount(entries);
      const inp = inpOf(entries);
      measured.push({ page: scenario.page, inp, interactions });
      const worst = entries.filter((e) => e.interactionId).sort((a, b) => b.duration - a.duration)[0];
      console.log(
        `run ${run} ${scenario.page}: INP ${Math.round(inp)} ms over ${interactions} interactions` +
          (worst ? ` (slowest: ${worst.name}${worst.target ? ` on ${worst.target}` : ''})` : ''),
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const rows = summarise(measured, budget);
const summary = renderMarkdown(rows, budget, cpuThrottle);
mkdirSync(results, { recursive: true });
writeFileSync(join(results, 'inp-summary.md'), summary);
console.log(`\n${summary}`);
if (process.env['GITHUB_STEP_SUMMARY']) appendFileSync(process.env['GITHUB_STEP_SUMMARY'], `\n${summary}`);
process.exit(rows.every((row) => row.pass) ? 0 : 1);
