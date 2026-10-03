#!/usr/bin/env node
// Lighthouse CI run against the compose stack (AICHAT-62, AICHAT-80):
//   1. registers and signs in the seeded test user (like scripts/dast/zap-session.ts) and creates one chat,
//   2. writes a temporary config: lighthouserc.json + the real chat id + the session cookie as an extra header,
//   3. runs `lhci autorun` (5 pages x 3 runs, assertions per page), 4. prints the median per page against its budget.
// The exit code is the one of lhci: 1 when a median is over its budget. The cookie is only in the temporary config
// (mode 600, deleted at the end) and is masked in the GitHub Actions log; it is never written to the reports.
// Variables: LH_PASSWORD (required), LH_BASE_URL (http://localhost:8000), LH_EMAIL, LH_CONFIG (lighthouserc.json),
// LH_RESULTS (lighthouse-results), LH_RUNS (overrides numberOfRuns).
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { signInSeededUser } from '../dast/zap-session.ts';
import { accessCookie, buildRunConfig, renderMarkdown, summarise } from './config.ts';
import type { LhciConfig, Report } from './config.ts';

const base = (process.env['LH_BASE_URL'] ?? 'http://localhost:8000').replace(/\/$/, '');
const email = process.env['LH_EMAIL'] ?? 'lighthouse-user@lighthouse.example.com';
// No literal fallback here (a secret must not have a default in code); testing/lighthouse/run.sh sets the password of the throw-away account.
const password = process.env['LH_PASSWORD'];
if (!password) throw new Error('LH_PASSWORD is not set (testing/lighthouse/run.sh sets it for the local stack)');
const results = process.env['LH_RESULTS'] ?? 'lighthouse-results';

const template = JSON.parse(readFileSync(process.env['LH_CONFIG'] ?? 'lighthouserc.json', 'utf8')) as LhciConfig;
if (process.env['LH_RUNS']) template.ci.collect.numberOfRuns = Number(process.env['LH_RUNS']);
template.ci.upload.outputDir = join(results, 'lhci');

const cookie = accessCookie((await signInSeededUser(base, email, password, 1)).split('; '));
if (!cookie) throw new Error('the seeded user has no access token cookie');
// A CI log must never show the cookie: mask it before anything can print it.
if (process.env['GITHUB_ACTIONS']) console.log(`::add-mask::${cookie.replace('access_token=', '')}`);
const chats = await fetch(`${base}/api/chats`, { headers: { Cookie: cookie } });
const chatId = ((await chats.json()) as { chats: { id: string }[] }).chats[0]?.id;
if (!chatId) throw new Error('the seeded user has no chat');

rmSync(join(results, 'lhci'), { recursive: true, force: true });
mkdirSync(results, { recursive: true });
const dir = mkdtempSync(join(tmpdir(), 'lhci-'));
const configPath = join(dir, 'lighthouserc.json');
writeFileSync(configPath, JSON.stringify(buildRunConfig(template, base, chatId, cookie)), { mode: 0o600 });

let status: number;
try {
  status = spawnSync('pnpm', ['exec', 'lhci', 'autorun', `--config=${configPath}`], { stdio: 'inherit' }).status ?? 1;
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const reports: Report[] = readdirSync(join(results, 'lhci'))
  .filter((f) => /\.report\.json$/.test(f))
  .map((f) => JSON.parse(readFileSync(join(results, 'lhci', f), 'utf8')) as { finalUrl: string; audits: Record<string, { numericValue: number }> })
  .map((lhr) => ({
    finalUrl: lhr.finalUrl,
    lcp: lhr.audits['largest-contentful-paint']?.numericValue ?? NaN,
    tbt: lhr.audits['total-blocking-time']?.numericValue ?? NaN,
    cls: lhr.audits['cumulative-layout-shift']?.numericValue ?? NaN,
  }));
const summary = `## Lighthouse CI: median of ${template.ci.collect.numberOfRuns} runs per page\n\n${renderMarkdown(summarise(reports, template.ci.assert.assertMatrix))}\n`;
writeFileSync(join(results, 'summary.md'), summary);
console.log(`\n${summary}`);
if (process.env['GITHUB_STEP_SUMMARY']) appendFileSync(process.env['GITHUB_STEP_SUMMARY'], summary);
process.exit(status);
