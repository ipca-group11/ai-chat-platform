import { describe, expect, it } from "vitest";
import { pdfFile } from "../../test-utils/file-fixtures.js";
import { extractPdfTextSandboxed } from "./pdf-sandbox.js";

describe("extractPdfTextSandboxed (AICHAT-254)", () => {
  it("extracts the text of a PDF in a worker thread", async () => {
    const text = await extractPdfTextSandboxed(pdfFile("Sandboxed hello"));
    expect(text).toContain("Sandboxed hello");
  });

  it("works on a buffer that is a slice of a larger allocation", async () => {
    const pdf = pdfFile("Sliced");
    const pooled = Buffer.concat([Buffer.from("junk"), pdf, Buffer.from("junk")]);
    expect(await extractPdfTextSandboxed(pooled.subarray(4, 4 + pdf.length))).toContain("Sliced");
  });

  it("yields undefined for a file the parser rejects", async () => {
    expect(await extractPdfTextSandboxed(Buffer.from("%PDF-1.4 not really a pdf"))).toBeUndefined();
  });

  it("gives up after the timeout and terminates the worker", async () => {
    const started = Date.now();
    expect(await extractPdfTextSandboxed(pdfFile(), { timeoutMs: 1 })).toBeUndefined();
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it("yields undefined, and the service lives on, when the parser runs out of its memory limit", async () => {
    expect(await extractPdfTextSandboxed(pdfFile(), { maxMemoryMb: 1 })).toBeUndefined();
    expect(await extractPdfTextSandboxed(pdfFile("after"))).toContain("after");
  });
});
