import { z } from 'zod';

// ── Server-side env (never exposed to browser) ──────────────────────

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Storage — optional (falls back to local uploads)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().default('gao-social-uploads'),
  R2_PUBLIC_URL: z.string().optional(),
});

// ── Client-side env (NEXT_PUBLIC_ prefix, safe to expose) ───────────

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().default('http://localhost:3000'),
  NEXT_PUBLIC_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  NEXT_PUBLIC_MAPTILER_KEY: z.string().default(''),

  // External APIs — optional
  NEXT_PUBLIC_PAYII_API_URL: z.string().default(''),
  NEXT_PUBLIC_DOMAIN_API_URL: z.string().default(''),
  NEXT_PUBLIC_NOTI_API_URL: z.string().default(''),
  NEXT_PUBLIC_WS_URL: z.string().default(''),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().default(''),
  NEXT_PUBLIC_GAO_MERCHANT_ID: z.string().default(''),

  // Firebase — optional
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().default(''),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().default(''),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().default(''),
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: z.string().default(''),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().default(''),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().default(''),
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: z.string().default(''),

  // Feature flags
  NEXT_PUBLIC_USE_MOCK_API: z.string().default('false'),
  NEXT_PUBLIC_KYC_ENABLED: z.string().default('false'),
  NEXT_PUBLIC_KYB_ENABLED: z.string().default('false'),
});

// ── Validate & export ───────────────────────────────────────────────

function validateEnv() {
  // Only validate server env on server side
  if (typeof window !== 'undefined') {
    return { server: null, client: clientSchema.parse(process.env) };
  }

  const server = serverSchema.safeParse(process.env);
  const client = clientSchema.safeParse(process.env);

  if (!server.success) {
    const errors = server.error.flatten().fieldErrors;
    console.error('\n❌ Invalid server environment variables:');
    Object.entries(errors).forEach(([key, msgs]) => {
      console.error(`  ${key}: ${msgs?.join(', ')}`);
    });
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing required environment variables. Check server logs.');
    }
    console.warn('⚠️  Continuing in development with missing env vars...\n');
  }

  if (!client.success) {
    const errors = client.error.flatten().fieldErrors;
    console.error('\n❌ Invalid client environment variables:');
    Object.entries(errors).forEach(([key, msgs]) => {
      console.error(`  ${key}: ${msgs?.join(', ')}`);
    });
  }

  return {
    server: server.success ? server.data : null,
    client: client.success ? client.data : null,
  };
}

export const env = validateEnv();

// Type-safe access
export type ServerEnv = z.infer<typeof serverSchema>;
export type ClientEnv = z.infer<typeof clientSchema>;
