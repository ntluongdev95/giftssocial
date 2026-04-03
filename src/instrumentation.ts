export async function register() {
  // Validate environment variables at server startup
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/lib/env');
  }
}
