import { describe, expect, it } from "vitest";
import { jpegFile, pdfFile, pngFile } from "../../test-utils/file-fixtures.js";
import { assertContentMatches, MAX_IMAGE_PIXELS } from "./content-check.js";

const rejects = (mimeType: string, buffer: Buffer, code = "ATTACHMENT_TYPE_NOT_ALLOWED") =>
  expect(() => assertContentMatches(mimeType, "f", buffer)).toThrow(expect.objectContaining({ statusCode: 400, code }));

describe("assertContentMatches (AICHAT-254, pentest H6)", () => {
  it.each([
    ["image/png", pngFile(640, 480)],
    ["image/jpeg", jpegFile(640, 480)],
    ["application/pdf", pdfFile()],
    ["text/plain", Buffer.from("plain text, accents ok: café ✓")],
    ["text/plain", Buffer.alloc(0)],
  ])("accepts a real %s file", (mimeType, buffer) => {
    expect(() => assertContentMatches(mimeType, "f", buffer)).not.toThrow();
  });

  it("rejects bytes that do not start with the signature of the claimed type", () => {
    rejects("image/png", jpegFile());
    rejects("image/jpeg", pngFile());
    rejects("application/pdf", Buffer.from("<html></html>"));
    rejects("image/png", Buffer.alloc(0));
  });

  it("rejects text with a NUL byte or invalid UTF-8", () => {
    rejects("text/plain", Buffer.from([0x61, 0x00, 0x62]));
    rejects("text/plain", Buffer.from([0xff, 0xfe, 0xfd]));
  });

  it("rejects a MIME type that is not on the allow-list", () => {
    rejects("application/zip", Buffer.from("PK"));
  });

  it("rejects an image header that is cut short or declares no pixels", () => {
    rejects("image/png", pngFile().subarray(0, 12));
    rejects("image/png", pngFile(0, 10));
    rejects("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x01])); // segment length < 2
    rejects("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x04, 0x00, 0x00, 0x12, 0x34])); // no frame before the scan data
    rejects("image/jpeg", Buffer.concat([jpegFile().subarray(0, 22), Buffer.from([0xff, 0xc0, 0x00])])); // frame cut short
  });

  it("skips JPEG fill bytes before a marker", () => {
    const withFill = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), jpegFile(2, 3).subarray(2)]);
    expect(() => assertContentMatches("image/jpeg", "f", withFill)).not.toThrow();
  });

  it("rejects an image whose declared canvas is over the pixel limit (decompression bomb)", () => {
    const side = Math.ceil(Math.sqrt(MAX_IMAGE_PIXELS)) + 1;
    rejects("image/png", pngFile(side, side), "ATTACHMENT_IMAGE_TOO_LARGE");
    rejects("image/jpeg", jpegFile(side, side), "ATTACHMENT_IMAGE_TOO_LARGE");
  });
});
