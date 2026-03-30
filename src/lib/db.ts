// ─── Gao Social V3 — Database Connections ─────────────────────────────────
// PostgreSQL (primary) + MongoDB (geo/signals) + Redis (cache/realtime)

import { Pool } from 'pg';
import mongoose from 'mongoose';
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

// ─── MongoDB ──────────────────────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB = 'gao-social';

let mongoConnecting: Promise<typeof mongoose> | null = null;

export async function connectMongo(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  if (mongoose.connection.readyState === 2 && mongoConnecting) {
    return mongoConnecting;
  }

  mongoConnecting = mongoose.connect(MONGODB_URI, { dbName: MONGODB_DB });

  try {
    await mongoConnecting;
    console.log('[MongoDB] Connected to', MONGODB_DB);
    return mongoose;
  } catch (err) {
    mongoConnecting = null;
    console.error('[MongoDB] Connection error:', (err as Error).message);
    throw err;
  }
}

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
