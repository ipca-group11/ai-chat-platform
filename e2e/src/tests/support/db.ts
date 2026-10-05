import { execFileSync } from "node:child_process";

// Postgres is not published to the host (compose.yaml), so the suite queries it with `psql`
// inside the compose container.
const container = process.env["E2E_POSTGRES_CONTAINER"] ?? "llm-chat-postgres-1";
const user = process.env["POSTGRES_USER"] ?? "llmchat";
const database = process.env["POSTGRES_DB"] ?? "llmchat";

/** Runs one statement against the auth schema; `:'email'` in the SQL is the quoted `email` value. */
function query(sql: string, email: string): string {
  return execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", user, "-d", database, "-At", "-q", "-v", "ON_ERROR_STOP=1", "-v", `email=${email}`],
    { input: sql, encoding: "utf8" },
  ).trim();
}

/** Stored password hash of the user with this email (case-insensitive), or null when there is none. */
export function findPasswordHash(email: string): string | null {
  const hash = query(`SELECT "passwordHash" FROM auth."User" WHERE lower(email) = lower(:'email');`, email);
  return hash === "" ? null : hash;
}

/** Number of accounts with this email, ignoring case. */
export function countUsers(email: string): number {
  return Number(query(`SELECT count(*) FROM auth."User" WHERE lower(email) = lower(:'email');`, email));
}

export function deleteUser(email: string): void {
  query(`DELETE FROM auth."User" WHERE lower(email) = lower(:'email');`, email);
}
