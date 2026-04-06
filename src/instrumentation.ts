export async function register() {
  // Validate environment variables at server startup
  // Skip on Cloudflare Workers (edge runtime) — env is accessed via getCloudflareContext()
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('@/lib/env');
  }
}
