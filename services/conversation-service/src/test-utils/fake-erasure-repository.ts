import type { ErasureRepository, ErasureResult } from "../features/erasure/repository.js";

/** Records the calls and answers with a canned result. The real queries are checked against
 * Postgres by the `test-db` suite. */
export class StubErasureRepository implements ErasureRepository {
  readonly calls: Array<{ userId: string; email: string }> = [];
  result: ErasureResult = { chats: 0, memberships: 0, messages: 0, storagePaths: [] };
  failWith: Error | undefined;

  async eraseUser(userId: string, email: string): Promise<ErasureResult> {
    this.calls.push({ userId, email });
    if (this.failWith) throw this.failWith;
    return this.result;
  }
}
