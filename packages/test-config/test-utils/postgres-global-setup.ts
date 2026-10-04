// Vitest `globalSetup` for the database tests (`test-db` Nx target): starts a throwaway Postgres with
// Testcontainers, applies the committed migrations of the service it runs in with `prisma migrate deploy`
// (what the Docker images run on boot, AICHAT-250), checks that they produce exactly prisma/schema.prisma,
// and exposes the connection string as DATABASE_URL to the test workers. The container is stopped when
// the run ends.
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

  const prisma = (args: string[]) =>
    execFileSync("pnpm", ["exec", "prisma", ...args], { cwd: process.cwd(), env: { ...process.env, DATABASE_URL: url }, stdio: "inherit" });

  prisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);
  // A schema change committed without its migration fails the run here (exit code 2 = the database differs).
  try {
    prisma(["migrate", "diff", "--from-url", url, "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"]);
  } catch (error) {
    await container.stop();
    throw new Error("prisma/schema.prisma differs from what prisma/migrations produce: add a migration (prisma migrate dev)", { cause: error });
  }

  return async () => {
    await container.stop();
  };
}
