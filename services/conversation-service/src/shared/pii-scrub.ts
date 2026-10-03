/**
 * Masking rule for logs (AICHAT-32, docs/AICHAT-32/WORKLOG.md section 1): emails and IP
 * addresses are dropped (not hashed), query strings are dropped from logged URLs, and
 * errors keep their type and message only. The same file sits in conversation-service.
 */
export const DROPPED = "[REDACTED]";

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
const OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4 = new RegExp(`(?<![\\w.])${OCTET}(?:\\.${OCTET}){3}(?![\\w]|\\.\\d)`, "g");
const HEX = "[0-9a-f]{1,4}";
const IPV6 = new RegExp(
  `(?<![\\w:])(?:(?:${HEX}:){7}${HEX}|(?:${HEX}:){1,7}:(?:${HEX}(?::${HEX}){0,6})?|::(?:ffff:)?${HEX}(?::${HEX}){0,6})(?![\\w:])`,
  "gi",
);
const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g;

/** `text` with every email, IP address and JWT replaced by `[REDACTED]`. */
export function scrubText(text: string): string {
  return text.replace(EMAIL, DROPPED).replace(IPV4, DROPPED).replace(IPV6, DROPPED).replace(JWT, DROPPED);
}

/** A URL or path as it may be logged: no query string, no fragment, no email or IP in the path. */
export function scrubUrl(url: string): string {
  const path = url.split(/[?#]/)[0] ?? "";
  let decoded = path;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    // keep the raw path when it is not valid percent-encoding
  }
  const scrubbed = scrubText(decoded);
  return scrubbed === decoded ? path : scrubbed;
}

/** The shape logged for an error: its type and a scrubbed message and stack, nothing else
 * (body-parser, multer and Prisma errors carry the request body, file names or values). */
export function serializeError(err: unknown): { type: string; message: string; stack?: string } {
  if (!(err instanceof Error)) return { type: typeof err, message: scrubText(String(err)) };
  return {
    type: err.name,
    message: scrubText(err.message),
    ...(err.stack ? { stack: scrubText(err.stack) } : {}),
  };
}
