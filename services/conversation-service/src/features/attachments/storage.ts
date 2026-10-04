import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

/** Small abstraction over "where attachment bytes live" so the service is testable
 * without touching a real disk, and so the storage backend (local filesystem volume per
 * STACK.md decision #3) is swappable later without touching business logic. */
export interface AttachmentStorage {
  save(buffer: Buffer, extension: string): Promise<string>;
  read(storagePath: string): Promise<Buffer>;
  /** Removes a stored file. A file that is already gone is not an error (the call is idempotent). */
  delete(storagePath: string): Promise<void>;
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
    async delete(storagePath) {
      // Only files inside the upload directory are ever removed, whatever a database row says.
      const root = path.resolve(uploadDir);
      const target = path.resolve(storagePath);
      if (!target.startsWith(root + path.sep)) {
        throw new Error("Refusing to delete a file outside the upload directory");
      }
      try {
        await unlink(target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    },
  };
}
