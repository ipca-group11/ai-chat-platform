#!/usr/bin/env node
// Generates real-user Web Vitals for the Faro dashboard (AICHAT-98) on a local stack: it visits the five pages in a real
// (headless) Chrome, clicks and types a little so INP is measured, and hides the page so Faro flushes LCP, CLS and INP.
// The vitals are the ones the browser measured; nothing is faked. They reach Loki through the shell's Faro setup.
//   node scripts/perf/field-visits.ts            # 6 rounds of 5 pages
// Variables: FIELD_PASSWORD (required), FIELD_BASE_URL (http://localhost:8000), FIELD_EMAIL, FIELD_ROUNDS (6), CHROME_PATH.
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { signInSeededUser } from '../dast/zap-session.ts';
import { chromeCandidates, plan } from './field-pages.ts';

const base = (process.env['FIELD_BASE_URL'] ?? 'http://localhost:8000').replace(/\/$/, '');
const email = process.env['FIELD_EMAIL'] ?? 'field-user@field.example.com';
// No literal fallback here (a secret must not have a default in code); the throw-away account's password comes from the caller.
const password = process.env['FIELD_PASSWORD'];
if (!password) throw new Error('FIELD_PASSWORD is not set');
const rounds = Number(process.env['FIELD_ROUNDS'] ?? 6);

const cookieHeader = await signInSeededUser(base, email, password, 1);
const accessToken = cookieHeader.split('; ').find((pair) => pair.startsWith('access_token='))?.slice('access_token='.length);
if (!accessToken) throw new Error('the seeded user has no access token cookie');
const chats = (await (await fetch(`${base}/api/chats`, { headers: { Cookie: cookieHeader } })).json()) as { chats: { id: string }[] };
const chatId = chats.chats[0]?.id;
if (!chatId) throw new Error('the seeded user has no chat');

const executablePath = chromeCandidates(process.env).find((path) => existsSync(path));
if (!executablePath) throw new Error('no Chrome found: set CHROME_PATH');
const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
try {
  for (const visit of plan(chatId, rounds)) {
    // A fresh context per visit is a new visitor: no cache, no cookies.
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.setViewport({ width: 1350, height: 940 });
    if (visit.signedIn) await page.setCookie({ name: 'access_token', value: accessToken, url: base, httpOnly: true });
    await page.goto(`${base}${visit.path}`, { waitUntil: 'load' });
    // The chat page keeps a stream open, so the network never goes idle: wait a fixed moment for the page to settle.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    // A few interactions, so there is an INP to report.
    await page.mouse.click(675, 470);
    await page.keyboard.press('Tab');
    await page.keyboard.type('hello');
    await new Promise((resolve) => setTimeout(resolve, 600));
    // web-vitals reports LCP, CLS and INP when the page is hidden; Faro sends them a moment later.
    await page.evaluate(
      "Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange'));",
    );
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await context.close();
    console.log(`visited ${visit.path === `/chats/${chatId}` ? '/chats/:id' : visit.path} (${visit.signedIn ? 'signed in' : 'new visitor'})`);
  }
} finally {
  await browser.close();
}
