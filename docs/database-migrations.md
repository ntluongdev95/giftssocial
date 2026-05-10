# Database — schema, migrations, auto-update

Gao Social runs on Cloudflare D1 (SQLite). The canonical schema lives in
`schema-d1.sql`; every additive change ships as an idempotent file under
`src/db/migration-NNN-*.sql`. A small Node runner at `scripts/migrate.mjs`
records applied migrations and applies only what is new.

## Files

```
schema-d1.sql                                   ← canonical schema for fresh DBs
src/db/migration-001-complete-schema.sql        ← Postgres-only legacy (skipped on D1)
src/db/migration-002-auth-sessions.sql          ← Postgres-only legacy (skipped on D1)
src/db/migration-003-location-audience.sql      ← D1
src/db/migration-003-time-capsules.sql          ← D1
src/db/migration-004-capsule-notifications.sql  ← D1
src/db/migration-005-per-user-capsule-opens.sql ← D1
src/db/migration-006-gao-id-links.sql           ← D1 (also self-applied at runtime)
src/db/migration-007-gift-cards.sql             ← D1
src/db/migration-008-circles-avatar-…           ← D1
src/db/seed-*.sql                               ← idempotent seed data
```

The runner looks at `src/db/migration-*.sql`, ignores the two Postgres
files (`migration-001`, `migration-002`), and applies the rest in lexical
order on each target environment. Everything that has been applied is
recorded in `_migrations(name, hash, applied_at)`.

## NPM scripts

```bash
# Local (Wrangler local D1, via miniflare)
npm run db:init:local       # applies schema-d1.sql to a brand-new local DB
npm run db:migrate:local    # applies every pending migration file
npm run db:seed:local       # loads dev fixtures (users, businesses, gift cards…)
npm run db:reset:local      # init + migrate + seed in one shot
npm run db:check            # dry-run — print pending migrations, no DB writes

# Remote dev (gao-social-dev)
npm run db:migrate:dev

# Production (gao-social-db)
npm run db:migrate:prod

# “Mark as applied” without executing — use this after a manual hot-fix
# pre-applied a column/table and you want the ledger to catch up.
npm run db:migrate:mark:dev
npm run db:migrate:mark:prod
```

Behind the scenes each script invokes `node scripts/migrate.mjs --target=<env>`.
The runner shells out to `npx wrangler d1 execute …` so anything you can
do by hand is exactly what it does — no extra client.

## How the runner stays safe

* **Idempotent.** Runs only files not already in `_migrations`. Re-running
  is a no-op.
* **Non-destructive by default.** Migrations only `CREATE … IF NOT EXISTS`
  / `ALTER ADD COLUMN`. There is no destructive `db:reset` for remote DBs.
* **Hash recorded.** The sha256 of each applied file is stored, so you can
  audit drift later.
* **Fail fast.** Real errors (missing tables, syntax errors) abort with a
  non-zero exit. `wrangler` errors that match `duplicate column name` or
  `already exists` are tolerated, since those mean a previous half-applied
  state is now consistent.
* **No prod reset, ever.** There is intentionally no `db:reset:prod`
  script. Reset is local-only.

## Auto-update on deploy

`predeploy:cf:dev` is wired so `npm run deploy:cf:dev` applies pending
migrations to the dev database **before** the worker is published. Add an
equivalent `deploy:cf:prod` script (or CI step) the same way for prod.

CI workflows can call `npm run db:migrate:prod` as the step before
`wrangler deploy --env=production`. D1 does not safely expose DDL through
the runtime API, so keep migrations strictly as a build/CI step rather
than running them from the worker on cold start.

## Adding a new migration

1. Create `src/db/migration-NNN-<short-name>.sql`. Use `IF NOT EXISTS`
   wherever possible. For `ALTER TABLE … ADD COLUMN`, accept that the
   first apply will succeed; the runner's `_migrations` ledger guards
   subsequent runs.
2. Mirror the additive change inside `schema-d1.sql` so a fresh
   `db:init:local` produces the same final state.
3. Run `npm run db:migrate:local && npm run db:check` to verify.
4. Roll out: `npm run db:migrate:dev`, then `npm run db:migrate:prod`.

## D1 gotchas

* **No `BEGIN` / `COMMIT`.** Cloudflare D1 rejects raw SQL transactions
  with: *"please use the state.storage.transaction() API"*. Each
  `wrangler d1 execute --file=…` call is already atomic. Migrations must
  not include `BEGIN;` / `COMMIT;` lines.
* **No `ADD COLUMN IF NOT EXISTS`.** Use the runner's idempotent ledger
  (`_migrations`) plus the runner's "duplicate column name" tolerance.
* **No GIN / FTS by default.** Use `LIKE`-based search (see the search
  route) or a separate FTS5 virtual table per feature.

## Required env / wrangler bindings

The runner uses the locally installed `wrangler` and the bindings declared
in `wrangler.toml`:

* `[[d1_databases]] DB → gao-social-dev` (default + `[env.dev]`)
* `[[env.production.d1_databases]] DB → gao-social-db`

No additional env vars are required; the migration script does not read
secrets.
