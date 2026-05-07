/**
 * Gao ID — runtime config bound to NEXT_PUBLIC_* env vars.
 *
 * Each `process.env.NEXT_PUBLIC_*` reference is inlined at build time by
 * Next.js (literal property access only — do NOT use computed keys).
 * Values are sourced from the GitHub Environment Variables for the
 * `development` env (see .github/workflows/dev-cicd.yml). The kill
 * switch `NEXT_PUBLIC_GAO_ID_ENABLED` defaults to `false`; when off,
 * callers must short-circuit before invoking any client method.
 *
 * See docs/social-web-gao-id-auth-plan.md for the integration plan.
 */

function ensure(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `gao-id: missing required env var ${name}. Set it as a GitHub Environment Variable on env=development and ensure dev-cicd injects it into the Next build step.`,
    );
  }
  return value;
}

export interface GaoIdConfig {
  /** Issuer origin, e.g. https://id-test.gao.domains. */
  issuer: string;
  /** Gateway audience the access token is minted against, e.g. https://api-test.gao.domains. */
  audience: string;
  /** SIWE message `domain` field (bare host, no scheme). Must be in the issuer's SIWE_DOMAIN allowlist. */
  siweDomain: string;
  /** social-web canonical origin used as SIWE `URI` field. */
  appUrl: string;
}

export function getConfig(): GaoIdConfig {
  return {
    issuer: ensure('NEXT_PUBLIC_GAO_ID_API', process.env.NEXT_PUBLIC_GAO_ID_API),
    audience: ensure('NEXT_PUBLIC_GAO_ID_AUDIENCE', process.env.NEXT_PUBLIC_GAO_ID_AUDIENCE),
    siweDomain: ensure('NEXT_PUBLIC_GAO_ID_SIWE_DOMAIN', process.env.NEXT_PUBLIC_GAO_ID_SIWE_DOMAIN),
    appUrl: ensure('NEXT_PUBLIC_APP_URL', process.env.NEXT_PUBLIC_APP_URL),
  };
}

export function isGaoIdEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GAO_ID_ENABLED === 'true';
}
