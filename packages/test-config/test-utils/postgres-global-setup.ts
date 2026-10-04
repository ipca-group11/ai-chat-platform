// Vitest `globalSetup` for the database tests (`test-db` Nx target): starts a throwaway Postgres with
// Testcontainers, applies the schema of the service it runs in with `prisma db push` and exposes the
// connection string as DATABASE_URL to the test workers. The container is stopped when the run ends.
//
// Needs a running Docker daemon. The unit `test` target never loads this file.
import { execFileSync } from "node:child_process";
import { PostgreSqlContainer } from "@testcontainers/postgresql";

/** Same image and major version as compose.yaml; the official image, native on arm64 and amd64. */
export const POSTGRES_IMAGE = "postgres:16-alpine";

export default async function setup(): Promise<() => Promise<void>> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  const url = container.getConnectionUri();
  process.env.DATABASE_URL = url;

  // No migrations exist yet, so the schema is pushed (docs/AICHAT-33/README.md §4.2). Switch to
  // `prisma migrate deploy` when migrations are added.
  execFileSync("pnpm", ["exec", "prisma", "db", "push", "--skip-generate", "--schema", "prisma/schema.prisma"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });

  return async () => {
    await container.stop();
  };
}
