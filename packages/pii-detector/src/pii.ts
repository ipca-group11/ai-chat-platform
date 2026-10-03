/**
 * PII detector for telemetry tests (AICHAT-32). Give it the text a service or the browser
 * produced (log lines, a `/metrics` scrape, a Faro payload) and it returns every email,
 * IP address, session token or known canary it finds. A test asserts the result is empty.
 *
 * Node only, no DOM, so services can import it through `@platform/test-utils/pii`.
 * The placeholder `[REDACTED]` is never a match.
 */
export type PiiKind = "email" | "ip" | "token" | "canary";

export interface PiiMatch {
  kind: PiiKind;
  value: string;
  /** Where the match starts in the text that was scanned. */
  index: number;
}

export interface FindPiiOptions {
  /** Unique strings the test planted in its input (a message body, an attachment name, an email). */
  canaries?: readonly string[];
  /** Kinds to skip, for the rare test that expects one on purpose. */
  ignore?: readonly PiiKind[];
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
const OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4 = new RegExp(`(?<![\\w.])${OCTET}(?:\\.${OCTET}){3}(?![\\w]|\\.\\d)`, "g");
const HEX = "[0-9a-f]{1,4}";
const IPV6 = new RegExp(
  `(?<![\\w:])(?:(?:${HEX}:){7}${HEX}|(?:${HEX}:){1,7}:(?:${HEX}(?::${HEX}){0,6})?|::(?:ffff:)?${HEX}(?::${HEX}){0,6})(?![\\w:])`,
  "gi",
);

/** Token shapes: a JWT, a bearer credential, a session cookie pair with a real value, a provider API key. */
const TOKEN_PATTERNS: readonly RegExp[] = [
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g,
  /\bBearer\s+(?!\[REDACTED\])[A-Za-z0-9._~+/=-]{8,}/g,
  /\b(?:access_token|refresh_token|session|sid)=(?!\[REDACTED\]|;|"|\s|$)[^;\s"',]{8,}/g,
  /\bsk-[A-Za-z0-9_-]{12,}/g,
];

function scan(text: string, pattern: RegExp, kind: PiiKind, into: PiiMatch[]): void {
  for (const m of text.matchAll(pattern)) into.push({ kind, value: m[0], index: m.index ?? 0 });
}

function decoded(text: string): string | undefined {
  try {
    const out = decodeURIComponent(text);
    return out === text ? undefined : out;
  } catch {
    return undefined;
  }
}

/** Every PII match in `text`, in order of position. Percent-encoded text (a URL with `%40`) is scanned decoded too. */
export function findPii(text: string, options: FindPiiOptions = {}): PiiMatch[] {
  const found: PiiMatch[] = [];
  const views = [text];
  const plain = decoded(text);
  if (plain) views.push(plain);

  for (const view of views) {
    scan(view, EMAIL, "email", found);
    scan(view, IPV4, "ip", found);
    scan(view, IPV6, "ip", found);
    for (const pattern of TOKEN_PATTERNS) scan(view, pattern, "token", found);
    for (const canary of options.canaries ?? []) {
      if (!canary) continue;
      scan(view, new RegExp(canary.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "canary", found);
    }
  }

  const ignore = new Set(options.ignore ?? []);
  const seen = new Set<string>();
  return found
    .filter((m) => !ignore.has(m.kind))
    .filter((m) => {
      const key = `${m.kind}|${m.value}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.index - b.index);
}

/** `findPii` over many texts (log lines, metric lines). Each match names the line it came from. */
export function findPiiInLines(lines: readonly string[], options: FindPiiOptions = {}): Array<PiiMatch & { line: number }> {
  return lines.flatMap((text, line) => findPii(text, options).map((m) => ({ ...m, line })));
}

const SHOWN = 24;

/** One readable line per match, for an assertion message. A long value (a token) is cut, so a
 * failing test does not print a credential into the CI log. */
export function describePii(matches: ReadonlyArray<PiiMatch & { line?: number }>): string {
  return matches
    .map((m) => {
      const value = m.value.length > SHOWN ? `${m.value.slice(0, SHOWN)}... (${m.value.length} characters)` : m.value;
      return `${m.kind} "${value}"${m.line === undefined ? "" : ` on line ${m.line + 1}`}`;
    })
    .join("\n");
}

/** A destination for pino (or any `write(chunk)` sink) that keeps what was written, one entry per log line. */
export interface LogCapture {
  write(chunk: string): void;
  /** Raw lines written so far. */
  lines(): string[];
  /** Lines parsed as JSON. */
  records(): Array<Record<string, unknown>>;
  clear(): void;
}

export function createLogCapture(): LogCapture {
  let lines: string[] = [];
  return {
    write(chunk: string) {
      lines.push(...chunk.split("\n").filter(Boolean));
    },
    lines: () => [...lines],
    records: () => lines.map((l) => JSON.parse(l) as Record<string, unknown>),
    clear() {
      lines = [];
    },
  };
}
