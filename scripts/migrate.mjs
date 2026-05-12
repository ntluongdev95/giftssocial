#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// scripts/migrate.mjs — Cloudflare D1 migration runner
//
// Source-of-truth for fresh DBs:   schema-d1.sql
// Per-feature additive deltas:     src/db/migration-NNN-*.sql
//
// Behaviour:
//   1. Discovers D1-compatible migration files in src/db/.
//   2. Skips legacy Postgres-only migrations (001 / 002).
//   3. Ensures the _migrations ledger exists.
//   4. Applies every migration not yet recorded, in lexical order, then
//      records it with a sha256 of the file contents.
//   5. Treats "duplicate column name" / "table already exists" wrangler
//      errors as idempotent success (so re-running on a half-patched DB
//      is safe).
//   6. Surfaces real failures as non-zero exit (fail fast).
//
// Targets:
//   --target=local       wrangler d1 execute gao-social-dev --local
//   --target=dev         wrangler d1 execute gao-social-dev --remote --env=dev
//   --target=production  wrangler d1 execute gao-social-db  --remote --env=production
//
// Flags:
//   --init               Run schema-d1.sql first (use on a brand-new DB).
//   --mark               Skip execution, just record migrations as applied.
//                        Useful when the DB was hot-patched manually.
//   --dry-run            Print the plan without touching the DB.
// ─────────────────────────────────────────────────────────────────────────

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const MIGRATIONS_DIR = join(REPO_ROOT, 'src/db');
const SCHEMA_FILE = join(REPO_ROOT, 'schema-d1.sql');

// Postgres-style files kept in src/db/ for historical reference but never
// applied to D1 — they would error on SQLite (gen_random_uuid, JSONB, …).
const POSTGRES_ONLY = new Set([
  'migration-001-complete-schema.sql',
  'migration-002-auth-sessions.sql',
]);

// Idempotent error fragments — re-running a partially applied migration
// should not be fatal.
const IDEMPOTENT_ERRORS = [
  'duplicate column name',
  'already exists',
];

function parseArgs(argv) {
  const args = { target: 'local', init: false, mark: false, dryRun: false };
  for (const a of argv.slice(2)) {
    if (a.startsWith('--target=')) args.target = a.slice('--target='.length);
    else if (a === '--init') args.init = true;
    else if (a === '--mark') args.mark = true;
    else if (a === '--dry-run') args.dryRun = true;
    else throw new Error(`Unknown arg: ${a}`);
  }
  if (!['local', 'dev', 'production'].includes(args.target)) {
    throw new Error(`--target must be local|dev|production, got "${args.target}"`);
  }
  return args;
}

function wranglerArgsFor(target) {
  // Returns the trailing wrangler-d1 args specific to this environment.
  // Database name + flags map mirrors wrangler.toml.
  switch (target) {
    case 'local':
      return { db: 'gao-social-dev', extra: ['--local'] };
    case 'dev':
      return { db: 'gao-social-dev', extra: ['--remote', '--env=dev'] };
    case 'production':
      return { db: 'gao-social-db', extra: ['--remote', '--env=production'] };
  }
  throw new Error(`bad target ${target}`);
}

function runWrangler(args, opts = {}) {
  // Always pipe stderr so we can inspect it for idempotent errors (when
  // stdio is 'inherit', the captured buffer is not attached to the thrown
  // Error). On success we mirror stdout/stderr back to the parent so the
  // user still sees wrangler output.
  const result = execFileSync('npx', ['wrangler', 'd1', ...args], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (!opts.silent && result) process.stdout.write(result);
  return result;
}

function execSqlFile(target, filePath) {
  const { db, extra } = wranglerArgsFor(target);
  return runWrangler([
    'execute', db,
    ...extra,
    `--file=${filePath}`,
  ]);
}

function execSqlInline(target, sql, opts = {}) {
  const { db, extra } = wranglerArgsFor(target);
  return runWrangler([
    'execute', db,
    ...extra,
    `--command=${sql}`,
  ], opts);
}

function ensureMigrationsTable(target) {
  // Belt-and-suspenders: schema-d1.sql also creates this, but a brand-new
  // DB or a half-applied state may not have it yet.
  const sql = `CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    hash TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );`;
  execSqlInline(target, sql);
}

function listAppliedMigrations(target) {
  const { db, extra } = wranglerArgsFor(target);
  const out = runWrangler([
    'execute', db,
    ...extra,
    `--command=SELECT name FROM _migrations ORDER BY name`,
    '--json',
  ], { silent: true });
  // wrangler --json may emit either an array of result objects or a single
  // result object depending on version. Handle both.
  try {
    const parsed = JSON.parse(out);
    const rows = Array.isArray(parsed)
      ? parsed.flatMap(r => r.results ?? [])
      : (parsed.results ?? []);
    return new Set(rows.map(r => r.name));
  } catch {
    return new Set();
  }
}

function discoverMigrations() {
  return readdirSync(MIGRATIONS_DIR)
    .filter(f => /^migration-\d+.*\.sql$/.test(f))
    .filter(f => !POSTGRES_ONLY.has(f))
    .sort();
}

function sha256OfFile(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function applyOne(target, file, dryRun) {
  const fullPath = join(MIGRATIONS_DIR, file);
  const hash = sha256OfFile(fullPath);
  console.log(`→ applying ${file} (sha256=${hash.slice(0, 12)})`);
  if (dryRun) return { hash, executed: false };
  try {
    execSqlFile(target, fullPath);
    return { hash, executed: true };
  } catch (err) {
    const msg = String(err.stderr || err.stdout || err.message).toLowerCase();
    if (IDEMPOTENT_ERRORS.some(p => msg.includes(p))) {
      console.log(`   (idempotent — already partially applied; recording)`);
      return { hash, executed: false };
    }
    throw err;
  }
}

function record(target, file, hash) {
  // INSERT OR REPLACE so --mark can rewrite a stale entry and the runner
  // can be re-run without orphaning incomplete rows.
  const escaped = file.replace(/'/g, "''");
  execSqlInline(
    target,
    `INSERT OR REPLACE INTO _migrations (name, hash, applied_at) VALUES ('${escaped}', '${hash}', datetime('now'));`
  );
}

function main() {
  const args = parseArgs(process.argv);
  if (!existsSync(SCHEMA_FILE)) {
    throw new Error(`schema file missing: ${SCHEMA_FILE}`);
  }

  console.log(
    `db:migrate target=${args.target}` +
      (args.dryRun ? ' (dry-run)' : '') +
      (args.mark ? ' (mark only)' : '')
  );

  if (args.init) {
    console.log(`→ initialising fresh schema from schema-d1.sql`);
    if (!args.dryRun) execSqlFile(args.target, SCHEMA_FILE);
  }

  if (!args.dryRun) ensureMigrationsTable(args.target);
  const applied = args.dryRun ? new Set() : listAppliedMigrations(args.target);
  const pending = discoverMigrations().filter(f => !applied.has(f));

  if (pending.length === 0) {
    console.log('✓ database up to date — no pending migrations');
    return;
  }

  console.log(`pending: ${pending.join(', ')}`);

  for (const file of pending) {
    const fullPath = join(MIGRATIONS_DIR, file);
    const hash = sha256OfFile(fullPath);
    if (args.mark) {
      console.log(`→ marking ${file} as applied (no execute)`);
      if (!args.dryRun) record(args.target, file, hash);
      continue;
    }
    applyOne(args.target, file, args.dryRun);
    if (!args.dryRun) record(args.target, file, hash);
  }

  console.log(`✓ applied ${pending.length} migration(s)`);
}

try {
  main();
} catch (err) {
  console.error('✗ migration failed');
  console.error(err.stderr?.toString() || err.message);
  process.exit(1);
}
