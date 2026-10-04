#!/usr/bin/env node
// Screenshot of a Grafana dashboard for the evidence (AICHAT-98), taken with headless Chrome on the local stack.
//   node scripts/perf/dashboard-shot.ts --uid web-vitals-by-page --out docs/AICHAT-21/evidence/06-grafana-web-vitals.png
// Variables: GRAFANA_URL (http://localhost:3300), GRAFANA_USER (admin), GRAFANA_PASSWORD (required), CHROME_PATH.
import { existsSync } from 'node:fs';
import puppeteer from 'puppeteer-core';
import { chromeCandidates } from './field-pages.ts';

const args = process.argv.slice(2);
const option = (name: string): string | undefined => args[args.indexOf(`--${name}`) + 1];
const uid = option('uid');
const out = option('out');
if (!uid || !out) throw new Error('usage: dashboard-shot.ts --uid <dashboard uid> --out <file.png>');
const grafana = (process.env['GRAFANA_URL'] ?? 'http://localhost:3300').replace(/\/$/, '');
const password = process.env['GRAFANA_PASSWORD'];
if (!password) throw new Error('GRAFANA_PASSWORD is not set');
const executablePath = chromeCandidates(process.env).find((path) => existsSync(path));
if (!executablePath) throw new Error('no Chrome found: set CHROME_PATH');

const browser = await puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1000, deviceScaleFactor: 1 });
  await page.goto(`${grafana}/login`, { waitUntil: 'load' });
  await page.waitForSelector('input[name="user"]');
  await page.type('input[name="user"]', process.env['GRAFANA_USER'] ?? 'admin');
  await page.type('input[name="password"]', password);
  await page.click('button[type="submit"]');
  // A fresh Grafana asks to change the default password; skip it (the stack is throw-away).
  await page.waitForFunction("[...document.querySelectorAll('a, button')].some((e) => e.textContent === 'Skip') || !location.pathname.startsWith('/login')");
  await page.evaluate("[...document.querySelectorAll('a, button')].find((e) => e.textContent === 'Skip')?.click()");
  await page.waitForFunction("!location.pathname.startsWith('/login')");
  await page.goto(`${grafana}/d/${uid}?orgId=1&from=now-1h&to=now&kiosk`, { waitUntil: 'load' });
  await new Promise((resolve) => setTimeout(resolve, 15000)); // the panels query Loki after the page loads
  await page.screenshot({ path: out, fullPage: false });
  console.log(`saved ${out}`);
} finally {
  await browser.close();
}
