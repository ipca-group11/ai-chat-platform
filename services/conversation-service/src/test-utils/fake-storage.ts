import { randomUUID } from "node:crypto";
import type { AttachmentStorage } from "../features/attachments/storage.js";

export class FakeStorage implements AttachmentStorage {
  private readonly files = new Map<string, Buffer>();

  async save(buffer: Buffer, extension: string): Promise<string> {
    const key = `${randomUUID()}${extension}`;
    this.files.set(key, buffer);
    return key;
  }

  async read(storagePath: string): Promise<Buffer> {
    const buffer = this.files.get(storagePath);
    if (!buffer) throw new Error(`No file stored at ${storagePath}`);
    return buffer;
  }

  /** Test helper: is a file still stored? */
  has(storagePath: string): boolean {
    return this.files.has(storagePath);
  }

  /** Test helper: how many files are stored. */
  get count(): number {
    return this.files.size;
  }
}
