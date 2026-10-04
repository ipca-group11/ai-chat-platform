import { randomUUID } from "node:crypto";
import type { AttachmentStorage, StoredFile } from "../features/attachments/storage.js";

export class FakeStorage implements AttachmentStorage {
  private readonly files = new Map<string, Buffer>();
  private readonly modified = new Map<string, Date>();

  async save(buffer: Buffer, extension: string): Promise<string> {
    const key = `${randomUUID()}${extension}`;
    this.files.set(key, buffer);
    this.modified.set(key, new Date());
    return key;
  }

  async read(storagePath: string): Promise<Buffer> {
    const buffer = this.files.get(storagePath);
    if (!buffer) throw new Error(`No file stored at ${storagePath}`);
    return buffer;
  }

  async delete(storagePath: string): Promise<void> {
    this.files.delete(storagePath);
    this.modified.delete(storagePath);
  }

  async list(): Promise<StoredFile[]> {
    return [...this.files.keys()].map((storagePath) => ({ storagePath, modifiedAt: this.modified.get(storagePath) as Date }));
  }

  /** Test helper: pretend the file was saved at `date`. */
  setModifiedAt(storagePath: string, date: Date): void {
    this.modified.set(storagePath, date);
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
