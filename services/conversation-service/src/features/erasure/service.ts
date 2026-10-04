import type { FileCleanup } from "../attachments/index.js";
import type { ErasureRepository, ErasureResult } from "./repository.js";

export type ErasureSummary = Omit<ErasureResult, "storagePaths"> & { files: number };

export class ErasureService {
  constructor(
    private readonly repo: ErasureRepository,
    private readonly files: FileCleanup,
  ) {}

  /** Removes all data of a user (right to erasure). Database first, then the files: a file that
   * cannot be removed is left for the orphaned-file sweep of the retention job. */
  async eraseUser(userId: string, email: string): Promise<ErasureSummary> {
    const { storagePaths, ...counts } = await this.repo.eraseUser(userId, email);
    await this.files.remove(storagePaths);
    return { ...counts, files: storagePaths.length };
  }
}
