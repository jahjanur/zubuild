# Running Zubuild on PostgreSQL

Local dev and CI use **SQLite** (zero setup, no Docker) — that stays the default.
**Staging/production run on PostgreSQL**; this is the cutover.

The schema is already Postgres-compatible: enum-like columns are `String`, there
are no SQLite-specific `@db.` types, and `@default(uuid())`/`@updatedAt` work on
both. `docs/postgres-init.sql` is the Postgres DDL generated from the schema for
reference (the real migration is created by `prisma migrate dev`).

## Why a cutover (and not an env flag)

Prisma's `datasource.provider` is a **fixed value in the schema**, not
env-driven, and **migration files are provider-locked** (`migration_lock.toml`).
So moving to Postgres means: change the provider, and regenerate the migrations
against Postgres (the SQLite migration SQL can't run there).

## Steps

1. **Start Postgres** (local parity; staging uses a managed instance):
   ```
   docker compose up -d db
   ```

2. **Point the API at it** — in `apps/api/.env`:
   ```
   DATABASE_URL="postgresql://zubuild:zubuild@localhost:5432/zubuild?schema=public"
   ```
   (Staging: use the managed URL, with `sslmode=require` as needed.)

3. **Flip provider + regenerate migrations**:
   ```
   ./scripts/switch-to-postgres.sh      # provider -> postgresql, archives SQLite migrations
   cd apps/api
   npx prisma migrate dev --name init   # creates + applies the Postgres init migration
   ```

4. **Seed + run**:
   ```
   npm run db:seed        # from repo root
   npm run dev            # API + web
   ```
   Verify: log in with `admin@aem-residence.com` / `admin`; create an order and
   download its PDF; check tenant isolation still holds.

For staging deploys, use `prisma migrate deploy` (applies committed migrations)
instead of `migrate dev`.

## Tests

The API test suite (`*.test.ts`) provisions **SQLite** temp DBs (`file:` URLs)
for speed and zero-setup CI. After the Postgres cutover they need a Postgres test
database — the pending follow-up is to make the harness read `TEST_DATABASE_URL`
and give each test file an isolated Postgres schema, plus a `postgres` service in
`.github/workflows/ci.yml`. Until then, run tests on SQLite.

## Production notes

- Set a strong `SESSION_SECRET`; consider a Postgres-backed session store instead
  of the file store.
- Use `sslmode=require` and a connection pooler (PgBouncer / provider pooling)
  for serverless.
- Back up before running `prisma migrate deploy`.
