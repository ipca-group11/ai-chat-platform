import type { TransportItem } from '@grafana/faro-web-sdk';

/**
 * Masking rule for the browser telemetry (AICHAT-32, docs/AICHAT-32/WORKLOG.md section 1), applied
 * in Faro's `beforeSend` to every item before it leaves the browser: emails, IP addresses and
 * tokens are replaced by `[REDACTED]`, URLs lose their query string and fragment, fields that
 * hold an identity, a secret or message content are replaced whatever their value, and the
 * Faro user meta (id, email, username) is not sent.
 */
export const REDACTED = '[REDACTED]';

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`(?<![\\w.])${OCTET}(?:\\.${OCTET}){3}(?![\\w]|\\.\\d)`, 'g');
const HEX = '[0-9a-f]{1,4}';
const IPV6 = new RegExp(
  `(?<![\\w:])(?:(?:${HEX}:){7}${HEX}|(?:${HEX}:){1,7}:(?:${HEX}(?::${HEX}){0,6})?|::(?:ffff:)?${HEX}(?::${HEX}){0,6})(?![\\w:])`,
  'gi',
);
const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/g;
const API_KEY = /\bsk-[A-Za-z0-9_-]{12,}/g;
const URL_IN_TEXT = /https?:\/\/[^\s"'<>)\]]+/g;

/** Keys whose value is replaced whatever it holds. */
const SENSITIVE_KEY =
  /^(e[-_]?mail|user[-_]?name|phone|password|passwd|token|access[-_]?token|refresh[-_]?token|authorization|cookie|set[-_]?cookie|api[-_]?key|ip|ip[-_]?address|content|reasoning|extracted[-_]?text|file[-_]?name)$/i;

function scrubText(text: string): string {
  return text
    .replace(EMAIL, REDACTED)
    .replace(JWT, REDACTED)
    .replace(BEARER, REDACTED)
    .replace(API_KEY, REDACTED)
    .replace(IPV4, REDACTED)
    .replace(IPV6, REDACTED);
}

/** A URL or path without query string and fragment, and without an email or address in it. */
export function scrubUrl(url: string): string {
  const path = url.split(/[?#]/)[0] ?? '';
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // keep the raw path when it is not valid percent-encoding
  }
  const scrubbed = scrubText(decoded);
  return scrubbed === decoded ? path : scrubbed;
}

/** Any string Faro would send: a whole URL or path, or text that may contain URLs. */
export function scrubString(value: string): string {
  if (/^(https?:\/\/|\/)\S*$/.test(value)) return scrubUrl(value);
  return scrubText(value.replace(URL_IN_TEXT, scrubUrl));
}

/** Deep copy of `value` with every string scrubbed and every sensitive key replaced. */
export function scrubValue(value: unknown, key?: string): unknown {
  if (key !== undefined && SENSITIVE_KEY.test(key)) return REDACTED;
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubValue(v, k)]));
  }
  return value;
}

/** Faro `beforeSend` hook: the item with its payload and meta scrubbed and without the user meta. */
export function scrubTransportItem<P>(item: TransportItem<P>): TransportItem<P> {
  const meta = scrubValue(item.meta) as TransportItem<P>['meta'];
  delete meta.user;
  return { ...item, payload: scrubValue(item.payload) as P, meta };
}
