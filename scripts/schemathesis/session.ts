#!/usr/bin/env node
// Signs in the seeded Schemathesis user (creating it and a few chats on the first run) and prints the Cookie header
// value with its access token, for `schemathesis run -H "Cookie: <value>"` (AICHAT-187). Same steps as the DAST
// session (scripts/dast/zap-session.ts). The cookie belongs to a throw-away account on a local stack and is only
// written to stdout.
// Variables: ST_BASE_URL (default http://localhost:8000, the shell, which proxies /auth and /api),
// ST_EMAIL, ST_PASSWORD (required), ST_CHATS (number of chats to seed, default 3).
import { pickCookies, signInSeededUser } from '../dast/zap-session.ts';

const base = (process.env['ST_BASE_URL'] ?? 'http://localhost:8000').replace(/\/$/, '');
const email = process.env['ST_EMAIL'] ?? 'schemathesis@schemathesis.example.com';
// No literal fallback here (a secret must not have a default in code); testing/schemathesis/run.sh sets it.
const password = process.env['ST_PASSWORD'];
if (!password) throw new Error('ST_PASSWORD is not set (testing/schemathesis/run.sh sets it for the local stack)');

const cookie = await signInSeededUser(base, email, password, Number(process.env['ST_CHATS'] ?? 3));
process.stdout.write(pickCookies(cookie, ['access_token']));
