import { describe, expect, it } from "vitest";
import { pdfFile } from "../../test-utils/file-fixtures.js";
import { extractText } from "./text-extractor.js";

describe("extractText", () => {
  it("AC-69: extracts UTF-8 text content for .txt attachments", async () => {
    const text = await extractText("text", Buffer.from("hello world", "utf-8"));
    expect(text).toBe("hello world");
  });

  it("AC-70: returns undefined for image attachments (sent as image input instead)", async () => {
    const text = await extractText("image", Buffer.from([0, 1, 2]));
    expect(text).toBeUndefined();
  });

  it("AC-69: extracts the text of a PDF (parsed in the sandbox, AICHAT-254)", async () => {
    expect(await extractText("pdf", pdfFile("Quarterly notes"))).toContain("Quarterly notes");
  });

  it("AC-69: does not throw for an unparsable PDF buffer", async () => {
    const text = await extractText("pdf", Buffer.from("not a real pdf"));
    expect(text === undefined || typeof text === "string").toBe(true);
  });
});
