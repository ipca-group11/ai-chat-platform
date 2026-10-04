import { HttpError } from "../../shared/error-handler.js";

/** Largest image accepted, in pixels (about 6300 x 6300). Images are not decoded here,
 * but they are later decoded by the model provider and by every browser that shows them,
 * so a small file that declares a huge canvas (a "pixel bomb") is refused up front. */
export const MAX_IMAGE_PIXELS = 40_000_000;

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff]);
const PDF_SIGNATURE = Buffer.from("%PDF-", "latin1");

interface Dimensions {
  width: number;
  height: number;
}

/** PNG: the IHDR chunk always comes first, right after the signature. */
function pngDimensions(buffer: Buffer): Dimensions | undefined {
  if (buffer.length < 24 || buffer.toString("latin1", 12, 16) !== "IHDR") return undefined;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/** JPEG: walks the marker segments up to the first start-of-frame (SOF0..SOF15, except
 * DHT/JPG/DAC, which share the range). */
function jpegDimensions(buffer: Buffer): Dimensions | undefined {
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) return undefined;
    const marker = buffer[offset + 1]!;
    if (marker === 0xff) {
      offset += 1; // fill byte
      continue;
    }
    const length = buffer.readUInt16BE(offset + 2);
    const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isFrame) {
      if (offset + 9 > buffer.length) return undefined;
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (length < 2) return undefined;
    offset += 2 + length;
  }
  return undefined;
}

/** Valid UTF-8 with no NUL byte: binary data renamed to `.txt` is refused. */
function isPlainText(buffer: Buffer): boolean {
  if (buffer.includes(0)) return false;
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}

function mismatch(filename: string, what: string): HttpError {
  return new HttpError(400, "ATTACHMENT_TYPE_NOT_ALLOWED", `File "${filename}" does not contain ${what}`);
}

function checkImage(filename: string, dimensions: Dimensions | undefined, what: string): void {
  if (!dimensions || dimensions.width === 0 || dimensions.height === 0) throw mismatch(filename, what);
  if (dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) {
    throw new HttpError(
      400,
      "ATTACHMENT_IMAGE_TOO_LARGE",
      `Image "${filename}" is ${dimensions.width}x${dimensions.height} pixels; the limit is ${MAX_IMAGE_PIXELS / 1_000_000} megapixels`,
    );
  }
}

/** AICHAT-254 (pentest H6): the extension and MIME type come from the client, so the
 * bytes are checked too. Each allowed type must start with its signature (magic bytes);
 * text must be NUL-free UTF-8; images must declare a sane size. */
export function assertContentMatches(mimeType: string, filename: string, buffer: Buffer): void {
  switch (mimeType) {
    case "image/png":
      if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) throw mismatch(filename, "a PNG image");
      checkImage(filename, pngDimensions(buffer), "a PNG image");
      return;
    case "image/jpeg":
      if (!buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) throw mismatch(filename, "a JPEG image");
      checkImage(filename, jpegDimensions(buffer), "a JPEG image");
      return;
    case "application/pdf":
      if (!buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)) throw mismatch(filename, "a PDF document");
      return;
    case "text/plain":
      if (!isPlainText(buffer)) throw mismatch(filename, "plain UTF-8 text");
      return;
    default:
      throw mismatch(filename, "an accepted file type");
  }
}
