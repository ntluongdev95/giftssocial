// ─── Gao Social V3 — Database Connections ─────────────────────────────────
// PostgreSQL (primary) + Redis (cache/realtime)

import { Pool } from 'pg';
import Redis from 'ioredis';

// ─── PostgreSQL ───────────────────────────────────────────────────────────

export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pgPool.on('error', (err) => {
  console.error('[PostgreSQL] Unexpected pool error:', err.message);
});

pgPool.on('connect', () => {
  console.log('[PostgreSQL] Client connected');
});

// ─── Redis ────────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    const delay = Math.min(times * 200, 5000);
    return delay;
  },
  lazyConnect: true,
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});
