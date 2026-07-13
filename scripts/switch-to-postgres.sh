#!/usr/bin/env bash
# Flip Zubuild from SQLite to PostgreSQL.
#
# SQLite migrations are provider-locked and can't run on Postgres, so this
# archives them and leaves you to generate a fresh Postgres init migration.
# Idempotent-ish: safe to read before running. Reversible via git.
#
# Prereqs: a running Postgres (docker compose up -d db) and DATABASE_URL pointing
# at it (see apps/api/.env.example). Run from the repo root.
set -euo pipefail

SCHEMA="apps/api/prisma/schema.prisma"
MIGRATIONS="apps/api/prisma/migrations"

if grep -q 'provider = "postgresql"' "$SCHEMA"; then
  echo "schema.prisma already on postgresql — nothing to switch."
else
  echo "1) schema.prisma: provider sqlite -> postgresql"
  # portable in-place sed (macOS + linux)
  perl -i -pe 's/provider = "sqlite"/provider = "postgresql"/' "$SCHEMA"
fi

if [ -d "$MIGRATIONS" ] && ls "$MIGRATIONS" | grep -q '_'; then
  BAK="${MIGRATIONS}.sqlite.bak"
  echo "2) Archiving SQLite migrations -> ${BAK}"
  rm -rf "$BAK"
  mv "$MIGRATIONS" "$BAK"
  mkdir -p "$MIGRATIONS"
fi

cat <<'NEXT'

3) Now generate the Postgres migrations + seed (Postgres must be running and
   DATABASE_URL must point at it):

   docker compose up -d db
   cd apps/api
   npx prisma migrate dev --name init     # creates the Postgres init migration + applies it
   npm run db:seed                          # from repo root: npm run db:seed
   npm run dev                              # from repo root: API + web

To verify: log in with admin@aem-residence.com / admin.

To undo (before committing): git checkout apps/api/prisma && rm -rf apps/api/prisma/migrations.sqlite.bak
NEXT
