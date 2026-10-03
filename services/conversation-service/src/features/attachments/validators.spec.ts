import { describe, expect, it } from "vitest";
import { HttpError } from "../../shared/error-handler.js";
import { validateAttachment } from "./validators.js";

const ONE_MB = 1024 * 1024;

describe("validateAttachment", () => {
  it("AC-67: accepts .txt, .pdf, .png, .jpeg, and .jpg with matching MIME types", () => {
    const cases: Array<[string, string]> = [
      ["a.txt", "text/plain"],
      ["a.pdf", "application/pdf"],
      ["a.png", "image/png"],
      ["a.jpeg", "image/jpeg"],
      ["a.jpg", "image/jpeg"],
    ];
    for (const [originalname, mimetype] of cases) {
      const result = validateAttachment({ originalname, mimetype, size: 1024 }, 10 * ONE_MB);
      expect(result.extension).toBe(originalname.slice(originalname.lastIndexOf(".")));
    }
  });

  it("AC-67: rejects a disallowed file extension", () => {
    expect(() => validateAttachment({ originalname: "a.exe", mimetype: "application/octet-stream", size: 1 }, 10 * ONE_MB)).toThrow(
      HttpError,
    );
  });

  it("AC-67: rejects a file whose MIME type does not match its extension", () => {
    expect(() => validateAttachment({ originalname: "a.txt", mimetype: "image/png", size: 1 }, 10 * ONE_MB)).toThrow(
      HttpError,
    );
  });

  it("AC-68: rejects files over 10 MB with a clear, specific message", () => {
    try {
      validateAttachment({ originalname: "big.txt", mimetype: "text/plain", size: 11 * ONE_MB }, 10 * ONE_MB);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).message).toContain("10 MB");
    }
  });

  it("AC-68: a disallowed type produces a specific message naming the file", () => {
    try {
      validateAttachment({ originalname: "malware.exe", mimetype: "application/x-msdownload", size: 1 }, 10 * ONE_MB);
      expect.unreachable();
    } catch (err) {
      expect((err as HttpError).message).toContain(".exe");
    }
  });
});
