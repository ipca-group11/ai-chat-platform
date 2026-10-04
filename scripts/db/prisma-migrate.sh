#!/bin/sh
# Applies the committed Prisma migrations of the service in the current directory
# (prisma/schema.prisma + prisma/migrations) to DATABASE_URL, then runs the given command, if any.
#
#   prisma-migrate.sh                    # migrate only (scripts/dev.sh)
#   prisma-migrate.sh node dist/main.js  # migrate, then start the service (Dockerfile CMD)
#
# `prisma migrate deploy` creates the schema named in DATABASE_URL's `?schema=` when it is missing,
# and applies only the migrations not yet recorded in `_prisma_migrations`.
#
# Databases created before AICHAT-250 were set up with `prisma db push`: their tables exist but
# there is no migration history, and `migrate deploy` refuses them (P3005). `db push` ran on every
# boot, so such a database matches the first (baseline) migration exactly. In that case the
# baseline is marked as applied and the deploy is retried, which then applies only what came later.
set -eu

prisma="${PRISMA_BIN:-npx prisma}"
schema_file=./prisma/schema.prisma

if ! output=$($prisma migrate deploy --schema="$schema_file" 2>&1); then
  printf '%s\n' "$output"
  case "$output" in
    *P3005*)
      baseline=$(find ./prisma/migrations -mindepth 1 -maxdepth 1 -type d | sort | head -n 1 | xargs basename)
      echo "No migration history on a database set up with db push: marking $baseline as applied."
      $prisma migrate resolve --applied "$baseline" --schema="$schema_file"
      $prisma migrate deploy --schema="$schema_file"
      ;;
    *)
      exit 1
      ;;
  esac
else
  printf '%s\n' "$output"
fi

if [ "$#" -gt 0 ]; then
  exec "$@"
fi
