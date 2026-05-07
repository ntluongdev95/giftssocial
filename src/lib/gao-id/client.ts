/**
 * Gao ID — client for the canonical identity issuer (gao-id-worker).
 *
 * Memory-only token store. Wraps these endpoints (v2 only — `/v1/me/*`
 * is legacy and never targeted from new code):
 *
 *   POST /v2/auth/nonce
 *   POST /v2/auth/verify
 *   POST /v2/auth/refresh
 *   POST /v2/auth/logout
 *   GET  /v2/auth/me
 *   GET  /v2/me/
 *   GET  /v2/me/profile
 *   PUT  /v2/me/profile
 *   POST /v2/me/avatar
 *
 * Storage rules (docs/social-web-gao-id-auth-plan.md §13):
 *   - accessToken / csrfToken: JS memory only.
 *   - refresh: HttpOnly cookie at the issuer origin; we use
 *     `credentials: 'include'` so the browser attaches it.
 *   - Never write Gao ID tokens to localStorage / sessionStorage /
 *     IndexedDB.
 */

import { getConfig } from './config';

export interface CanonicalProfile {
  rootId: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  website: string | null;
  location: string | null;
  socialX: string | null;
  socialTg: string | null;
  metadata: unknown;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface VerifyResponseUser {
  rootId: string;
  walletAddress: string;
  chainId: number;
  profile: CanonicalProfile | null;
}

export interface VerifyResponse {
  accessToken: string;
  expiresIn: number;
  csrfToken: string;
  user: VerifyResponseUser;
}

export interface NonceResponse {
  nonce: string;
  expiresAt: string;
}

export interface AuthMe {
  rootId: string;
  walletAddress: string;
  chainId: number;
}

/**
 * `/v2/me/` returns a composite view that's evolving on the issuer side.
 * We keep an open shape and only type the fields callers will read in
 * later phases. Treat extras as forward-compatible.
 */
export interface CompositeMe {
  identity?: AuthMe;
  profile?: CanonicalProfile | null;
  wallets?: unknown;
  domains?: unknown;
  billing?: unknown;
  affiliate?: unknown;
  [key: string]: unknown;
}

export type AvatarMimeType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface AvatarUploadInput {
  mimeType: AvatarMimeType;
  /** Raw base64 (no data: prefix). ≤ 700 KB base64 / ≤ 512 KB decoded per issuer. */
  base64: string;
}

export interface AvatarUploadResponse {
  avatarUrl: string;
}

interface IssuerErrorBody {
  error?: string;
  message?: string;
  reason?: string;
}

/** Wraps a non-2xx response from the issuer with the parsed body fields. */
export class GaoIdRequestError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly reason: string | null;
  constructor(status: number, code: string | null, reason: string | null, message: string) {
    super(message);
    this.name = 'GaoIdRequestError';
    this.status = status;
    this.code = code;
    this.reason = reason;
  }
}

async function readError(r: Response): Promise<IssuerErrorBody> {
  try {
    return (await r.json()) as IssuerErrorBody;
  } catch {
    return {};
  }
}

function fail(status: number, body: IssuerErrorBody, fallback: string): never {
  throw new GaoIdRequestError(
    status,
    body.error ?? null,
    body.reason ?? null,
    body.message ?? body.error ?? fallback,
  );
}

export class GaoIdClient {
  private accessToken: string | null = null;
  private csrfToken: string | null = null;
  private expiresAt = 0;

  // ── /v2/auth/* ────────────────────────────────────────────────────

  async nonce(address: `0x${string}`, chainId: number): Promise<NonceResponse> {
    const { issuer } = getConfig();
    const r = await fetch(`${issuer}/v2/auth/nonce`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address, chainId }),
    });
    if (!r.ok) fail(r.status, await readError(r), 'gao-id nonce failed');
    return (await r.json()) as NonceResponse;
  }

  async verify(message: string, signature: `0x${string}`): Promise<VerifyResponse> {
    const { issuer } = getConfig();
    const r = await fetch(`${issuer}/v2/auth/verify`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, signature }),
    });
    if (!r.ok) fail(r.status, await readError(r), 'gao-id verify failed');
    const data = (await r.json()) as VerifyResponse;
    this.applyTokens(data.accessToken, data.csrfToken, data.expiresIn);
    return data;
  }

  /**
   * Rotate the refresh family and mint new access + csrf. Browser must
   * have the issuer's HttpOnly `gao_refresh` cookie (set on prior
   * verify); `credentials: 'include'` ensures it gets sent.
   *
   * Per `auth-v2.ts` head comment, the issuer no longer enforces
   * X-CSRF-Token (origin-guard replaces it), but we keep sending it
   * when present for forward-compat.
   */
  async refresh(): Promise<VerifyResponse> {
    const { issuer } = getConfig();
    const headers: Record<string, string> = {};
    if (this.csrfToken) headers['X-CSRF-Token'] = this.csrfToken;
    const r = await fetch(`${issuer}/v2/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers,
    });
    if (!r.ok) {
      const body = await readError(r);
      this.reset();
      fail(r.status, body, 'gao-id refresh failed');
    }
    const data = (await r.json()) as VerifyResponse;
    this.applyTokens(data.accessToken, data.csrfToken, data.expiresIn);
    return data;
  }

  async logout(): Promise<void> {
    const { issuer } = getConfig();
    const headers: Record<string, string> = {};
    if (this.csrfToken) headers['X-CSRF-Token'] = this.csrfToken;
    try {
      await fetch(`${issuer}/v2/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers,
      });
    } finally {
      this.reset();
    }
  }

  /** Lightweight session-validity probe; bearer only. */
  async authMe(): Promise<AuthMe> {
    return this.bearerGet<AuthMe>('/v2/auth/me');
  }

  // ── /v2/me/* ──────────────────────────────────────────────────────

  /** Canonical composite view — identity + profile + wallets + domains in one round-trip. */
  async getCompositeMe(): Promise<CompositeMe> {
    return this.bearerGet<CompositeMe>('/v2/me/');
  }

  async getProfile(): Promise<CanonicalProfile> {
    return this.bearerGet<CanonicalProfile>('/v2/me/profile');
  }

  async putProfile(patch: Partial<CanonicalProfile>): Promise<CanonicalProfile> {
    return this.bearerSend<CanonicalProfile>('/v2/me/profile', 'PUT', patch);
  }

  async uploadAvatar(input: AvatarUploadInput): Promise<AvatarUploadResponse> {
    return this.bearerSend<AvatarUploadResponse>('/v2/me/avatar', 'POST', input);
  }

  // ── token state plumbing ──────────────────────────────────────────

  /**
   * Used by the store to mirror tokens after `verify`/`refresh` rather
   * than reaching into the client. The client also keeps its own copy
   * so bearer-protected calls work without the caller threading
   * tokens through.
   */
  applyTokens(accessToken: string, csrfToken: string, expiresIn: number): void {
    this.accessToken = accessToken;
    this.csrfToken = csrfToken;
    this.expiresAt = Date.now() + expiresIn * 1000;
  }

  reset(): void {
    this.accessToken = null;
    this.csrfToken = null;
    this.expiresAt = 0;
  }

  isAuthenticated(): boolean {
    return this.accessToken !== null && Date.now() < this.expiresAt;
  }

  private async authHeader(): Promise<string> {
    if (!this.accessToken) {
      throw new GaoIdRequestError(401, 'not_authenticated', null, 'gao-id: no access token in memory');
    }
    if (Date.now() > this.expiresAt - 30_000) {
      await this.refresh();
    }
    return `Bearer ${this.accessToken}`;
  }

  private async bearerGet<T>(path: string): Promise<T> {
    const { issuer } = getConfig();
    const r = await fetch(`${issuer}${path}`, {
      headers: { authorization: await this.authHeader() },
    });
    if (!r.ok) fail(r.status, await readError(r), `gao-id GET ${path} failed`);
    return (await r.json()) as T;
  }

  private async bearerSend<T>(path: string, method: 'POST' | 'PUT', body: unknown): Promise<T> {
    const { issuer } = getConfig();
    const r = await fetch(`${issuer}${path}`, {
      method,
      headers: {
        authorization: await this.authHeader(),
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) fail(r.status, await readError(r), `gao-id ${method} ${path} failed`);
    return (await r.json()) as T;
  }
}

/**
 * Module-level singleton. The store reads/writes through this instance
 * so token state stays in one place; tests can construct their own
 * `new GaoIdClient()` for isolation.
 */
export const gaoIdClient = new GaoIdClient();
