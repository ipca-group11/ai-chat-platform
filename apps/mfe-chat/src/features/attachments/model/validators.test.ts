import { describe, expect, it } from "vitest";
import { attachmentKindFromMime, MAX_FILE_SIZE_BYTES, validateAttachmentFile } from "./validators";

function makeFile(name: string, type: string, sizeBytes: number): File {
  const file = new File([new Uint8Array(sizeBytes)], name, { type });
  return file;
}

describe("validateAttachmentFile (AC-67, AC-68)", () => {
  it("AC-67: accepts a .txt file with a matching MIME type", () => {
    const file = makeFile("notes.txt", "text/plain", 100);
    expect(validateAttachmentFile(file)).toBeNull();
  });

  it("AC-67: accepts .pdf, .png and .jpeg/.jpg files with matching MIME types", () => {
    expect(validateAttachmentFile(makeFile("doc.pdf", "application/pdf", 100))).toBeNull();
    expect(validateAttachmentFile(makeFile("image.png", "image/png", 100))).toBeNull();
    expect(validateAttachmentFile(makeFile("photo.jpeg", "image/jpeg", 100))).toBeNull();
    expect(validateAttachmentFile(makeFile("photo.jpg", "image/jpeg", 100))).toBeNull();
  });

  it("AC-67: rejects a disallowed extension even with an allowed-looking MIME type", () => {
    const file = makeFile("script.exe", "text/plain", 100);
    const error = validateAttachmentFile(file);
    expect(error?.code).toBe("invalid_type");
    expect(error?.message).toContain("script.exe");
  });

  it("AC-67: rejects when the extension is allowed but the MIME type doesn't match (both are checked)", () => {
    const file = makeFile("fake.txt", "application/x-msdownload", 100);
    const error = validateAttachmentFile(file);
    expect(error?.code).toBe("invalid_type");
  });

  it("AC-68: rejects files over the 10 MB limit with a clear, specific message", () => {
    const file = makeFile("big.txt", "text/plain", MAX_FILE_SIZE_BYTES + 1);
    const error = validateAttachmentFile(file);
    expect(error?.code).toBe("too_large");
    expect(error?.message).toContain("big.txt");
  });

  it("AC-68: accepts a file exactly at the 10 MB limit", () => {
    const file = makeFile("exact.txt", "text/plain", MAX_FILE_SIZE_BYTES);
    expect(validateAttachmentFile(file)).toBeNull();
  });
});

describe("attachmentKindFromMime", () => {
  it("classifies pdf, image and text MIME types", () => {
    expect(attachmentKindFromMime("application/pdf")).toBe("pdf");
    expect(attachmentKindFromMime("image/png")).toBe("image");
    expect(attachmentKindFromMime("image/jpeg")).toBe("image");
    expect(attachmentKindFromMime("text/plain")).toBe("text");
  });
});
