import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

/** Small abstraction over "where attachment bytes live" so the service is testable
 * without touching a real disk, and so the storage backend (local filesystem volume per
 * STACK.md decision #3) is swappable later without touching business logic. */
export interface AttachmentStorage {
  save(buffer: Buffer, extension: string): Promise<string>;
  read(storagePath: string): Promise<Buffer>;
}

export function createFileSystemStorage(uploadDir: string): AttachmentStorage {
  return {
    async save(buffer, extension) {
      await mkdir(uploadDir, { recursive: true });
      const filename = `${randomUUID()}${extension}`;
      const storagePath = path.join(uploadDir, filename);
      await writeFile(storagePath, buffer);
      return storagePath;
    },
    async read(storagePath) {
      return readFile(storagePath);
    },
  };
}
