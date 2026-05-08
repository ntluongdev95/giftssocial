// ─── Gao Social V3 — Cloudflare D1 + KV Adapters ──────────────────────────
// Replaces: pg.Pool (PostgreSQL) + ioredis (Redis)
// Bindings:  DB (D1Database), SOCIAL_KV (KVNamespace) — defined in wrangler.toml

import { getCloudflareContext } from '@opennextjs/cloudflare';

export function getDB(): D1Database {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { env } = (getCloudflareContext as any)() as { env: { DB: D1Database } };
  return env.DB;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getKV(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { env } = (getCloudflareContext as any)() as any;
  return env.SOCIAL_KV;
}

// ─── ID generation (replaces 'prefix_' || gen_random_uuid()) ──────────────

export function genId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${prefix}${hex}`;
}

// ─── JSON field parsing ────────────────────────────────────────────────────
// D1 stores arrays/objects as JSON strings. Parse them before returning to client.

const JSON_ARRAY_FIELDS = new Set([
  'badges', 'images', 'services', 'social_links', 'subcategories',
  'photos', 'skills', 'experience', 'education', 'languages',
  'recipient_ids',
]);
const JSON_OBJECT_FIELDS = new Set(['hours', 'metadata']);

export function parseRow<T extends Record<string, unknown>>(row: T | null): T | null {
  if (!row) return null;
  const out: Record<string, unknown> = { ...row };
  for (const f of JSON_ARRAY_FIELDS) {
    if (f in out && typeof out[f] === 'string') {
      try { out[f] = JSON.parse(out[f] as string); } catch { out[f] = []; }
    }
  }
  for (const f of JSON_OBJECT_FIELDS) {
    if (f in out && typeof out[f] === 'string') {
      try { out[f] = JSON.parse(out[f] as string); } catch { out[f] = {}; }
    }
  }
  return out as T;
}

export function parseRows<T extends Record<string, unknown>>(rows: T[]): T[] {
  return rows.map(r => parseRow(r) as T);
}
