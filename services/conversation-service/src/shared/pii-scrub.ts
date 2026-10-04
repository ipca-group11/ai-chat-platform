/**
 * Masking rule for logs (AICHAT-32, docs/AICHAT-32/WORKLOG.md section 1): emails and IP
 * addresses are dropped (not hashed), query strings are dropped from logged URLs, and
 * errors keep their type and message only; library errors that echo values get a fixed message
 * (AICHAT-234). The same file sits in conversation-service.
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

/** Prisma error codes that are worth keeping in a log line, with a fixed text (https://www.prisma.io/docs/orm/reference/error-reference). */
const PRISMA_CODES: Record<string, string> = {
  P2000: "value too long for the column",
  P2002: "unique constraint failed",
  P2003: "foreign key constraint failed",
  P2025: "record not found",
};

const PRISMA_ERRORS: Record<string, string> = {
  PrismaClientKnownRequestError: "Database request failed",
  PrismaClientUnknownRequestError: "Database request failed with an unknown error",
  PrismaClientValidationError: "Invalid database query",
  PrismaClientInitializationError: "Database client could not start",
  PrismaClientRustPanicError: "Database engine crashed",
};

const ownString = (err: Error, key: string): string | undefined => {
  const value = (err as unknown as Record<string, unknown>)[key];
  return typeof value === "string" && /^[\w.-]{1,64}$/.test(value) ? value : undefined;
};

/**
 * A fixed message for an error raised by a library whose message can echo what was sent to it
 * (AICHAT-234): Prisma prints the query with its values, body-parser the start of the body, Node's
 * file errors the path. Scrubbing emails and IPs is not enough there, so the message is replaced by
 * a fixed text that keeps only safe codes. Undefined for every other error.
 */
export function fixedMessageOf(err: Error): string | undefined {
  const prisma = PRISMA_ERRORS[err.name] ?? PRISMA_ERRORS[err.constructor.name];
  if (prisma) {
    const code = ownString(err, "code") ?? ownString(err, "errorCode");
    if (!code) return prisma;
    return `${prisma} (${code}${PRISMA_CODES[code] ? `: ${PRISMA_CODES[code]}` : ""})`;
  }
  // body-parser: `type` like "entity.parse.failed"; the JSON.parse message quotes the body.
  const bodyParserType = ownString(err, "type");
  if (bodyParserType?.startsWith("entity.") || bodyParserType?.startsWith("request.") || bodyParserType?.startsWith("encoding.")) {
    return `Request body could not be read (${bodyParserType})`;
  }
  // Node system errors (fs, net): the message holds the path or the address.
  const syscall = ownString(err, "syscall");
  const code = ownString(err, "code");
  if (syscall && code) return `System call ${syscall} failed (${code})`;
  return undefined;
}

/** The stack frames only, without the first lines that repeat the (unsafe) message. */
function framesOf(stack: string): string {
  return stack
    .split("\n")
    .filter((line) => /^\s+at /.test(line))
    .join("\n");
}

/** The shape logged for an error: its type and a safe message and stack, nothing else (body-parser,
 * multer and Prisma errors carry the request body, file names or values). Library errors that echo
 * values get a fixed message (`fixedMessageOf`); every other message is scrubbed of emails, IPs and tokens. */
export function serializeError(err: unknown): { type: string; message: string; stack?: string } {
  // pino-http hands a custom `err` serializer the output of pino's own one, with the error in `raw`.
  const raw = typeof err === "object" && err !== null ? (err as { raw?: unknown }).raw : undefined;
  if (!(err instanceof Error) && raw instanceof Error) return serializeError(raw);
  if (!(err instanceof Error)) return { type: typeof err, message: scrubText(String(err)) };
  const fixed = fixedMessageOf(err);
  if (fixed) {
    const frames = err.stack ? framesOf(err.stack) : "";
    return { type: err.name, message: fixed, ...(err.stack ? { stack: scrubText(`${err.name}: ${fixed}${frames ? `\n${frames}` : ""}`) } : {}) };
  }
  return {
    type: err.name,
    message: scrubText(err.message),
    ...(err.stack ? { stack: scrubText(err.stack) } : {}),
  };
}
