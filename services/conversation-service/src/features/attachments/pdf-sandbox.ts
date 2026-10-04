import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";

export interface PdfSandboxOptions {
  /** Wall-clock limit for one PDF; the worker is terminated after it. */
  timeoutMs?: number;
  /** V8 heap limit of the worker (old generation), in MB. */
  maxMemoryMb?: number;
}

export const PDF_TIMEOUT_MS = 15_000;
export const PDF_MAX_MEMORY_MB = 256;
const MIN_MEMORY_MB = 8;

/** Runs in the worker: plain CommonJS (an `eval` worker), so it needs no build step and
 * works the same under tsx, Vitest and the compiled service. */
const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const pdfParse = require(workerData.parser);
// A plain Uint8Array: the bundled pdf.js misreads a Node Buffer ("Illegal character").
pdfParse(workerData.pdf)
  .then((data) => parentPort.postMessage({ text: data.text }))
  .catch(() => parentPort.postMessage({ text: null }));
`;

const parserPath = createRequire(import.meta.url).resolve("pdf-parse");

/** AICHAT-254 (pentest H6): `pdf-parse` runs on untrusted PDFs, so it runs in a worker
 * thread with its own heap limit and a timeout. A PDF that crashes the parser, exhausts
 * the worker's memory or takes too long yields `undefined` (no extracted text) and never
 * takes the service down with it. */
export function extractPdfTextSandboxed(buffer: Buffer, options: PdfSandboxOptions = {}): Promise<string | undefined> {
  const timeoutMs = options.timeoutMs ?? PDF_TIMEOUT_MS;
  // Below a few MB the worker cannot even boot and V8 aborts the whole process instead.
  const maxMemoryMb = Math.max(MIN_MEMORY_MB, options.maxMemoryMb ?? PDF_MAX_MEMORY_MB);

  return new Promise((resolve) => {
    // A copy: the upload buffer may be a slice of a larger pooled allocation.
    const pdf = new Uint8Array(buffer);
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: { parser: parserPath, pdf },
      transferList: [pdf.buffer],
      resourceLimits: { maxOldGenerationSizeMb: maxMemoryMb, maxYoungGenerationSizeMb: 32, stackSizeMb: 4 },
      stdout: true,
      stderr: true,
    });
    let settled = false;
    const finish = (text: string | undefined) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      resolve(text);
    };
    const timer = setTimeout(() => finish(undefined), timeoutMs);
    worker.on("message", (message: { text: string | null }) => finish(message.text ?? undefined));
    worker.on("error", () => finish(undefined));
    worker.on("exit", () => finish(undefined));
  });
}
