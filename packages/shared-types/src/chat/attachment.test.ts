import { describe, expect, it } from "vitest";
import {
  ATTACHMENT_MAX_SIZE_BYTES,
  attachmentSchema,
} from "./attachment";

const base = {
  id: "att-1",
  messageId: "msg-1",
  ownerId: "user-1",
  originalFilename: "notes.txt",
  storedPath: "/data/uploads/notes.txt",
  extractedTextStatus: "pending" as const,
  createdAt: new Date().toISOString(),
};

describe("attachmentSchema", () => {
  it("AC-8: accepts a valid text attachment under the size limit", () => {
    const result = attachmentSchema.safeParse({
      ...base,
      mimeType: "text/plain",
      size: 1024,
    });
    expect(result.success).toBe(true);
  });

  it("AC-8: rejects an attachment over the 10 MB limit (FR15)", () => {
    const result = attachmentSchema.safeParse({
      ...base,
      mimeType: "application/pdf",
      size: ATTACHMENT_MAX_SIZE_BYTES + 1,
    });
    expect(result.success).toBe(false);
  });

  it("AC-8: rejects a disallowed mime type (FR14)", () => {
    const result = attachmentSchema.safeParse({
      ...base,
      mimeType: "application/zip",
      size: 100,
    });
    expect(result.success).toBe(false);
  });
});
