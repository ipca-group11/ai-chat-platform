// Helpers of scripts/perf/field-visits.ts (AICHAT-98): which pages a visit covers and how it is made. No browser, no network.

export interface Visit {
  /** Path on the shell. */
  path: string;
  /** Signed-in visitors carry the session cookie; /login and /register are visited like a new user, without it. */
  signedIn: boolean;
}

const PUBLIC_PATHS = ['/login', '/register'];
const SIGNED_IN_PATHS = ['/chats', '/chats/{CHAT_ID}', '/settings'];

/** One round of visits over the five audited pages, with the real chat id. */
export function visitsFor(chatId: string): Visit[] {
  return [
    ...PUBLIC_PATHS.map((path) => ({ path, signedIn: false })),
    ...SIGNED_IN_PATHS.map((path) => ({ path: path.replace('{CHAT_ID}', chatId), signedIn: true })),
  ];
}

/** `rounds` rounds of visits, in order. */
export function plan(chatId: string, rounds: number): Visit[] {
  return Array.from({ length: Math.max(0, rounds) }, () => visitsFor(chatId)).flat();
}

/** Chrome candidates, first existing one wins: CHROME_PATH, then the usual install paths. */
export function chromeCandidates(env: Record<string, string | undefined>): string[] {
  return [
    ...(env['CHROME_PATH'] ? [env['CHROME_PATH']] : []),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
  ];
}
