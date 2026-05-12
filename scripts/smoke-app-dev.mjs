#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────
// scripts/smoke-app-dev.mjs — non-destructive smoke test for app-dev
//
// Hits the public (or auth-optional) API surface of `app-dev.gao.social`
// after a deploy and verifies that the new feature wiring resolves to a
// live HTTP response. Does NOT mutate state.
//
// Run:
//   node scripts/smoke-app-dev.mjs                    # default base
//   node scripts/smoke-app-dev.mjs --base=<url>       # override base URL
//
// Exit code: 0 if all tests pass (or deliberately skipped), 1 otherwise.
// Each failure prints the URL, status, and a short message; success is
// terse so the output stays scannable in CI.
// ─────────────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, ...rest] = a.replace(/^--/, '').split('=');
    return [k, rest.join('=')];
  })
);

const BASE = (args.base || 'https://app-dev.gao.social').replace(/\/$/, '');
const TIMEOUT_MS = 12_000;

const results = [];

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function fetchWithTimeout(url, init = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function expect(name, url, opts = {}) {
  const { method = 'GET', expectStatus = [200], jsonShape, parseJson = true } = opts;
  let res, body;
  try {
    res = await fetchWithTimeout(`${BASE}${url}`, { method });
    if (parseJson && res.headers.get('content-type')?.includes('application/json')) {
      body = await res.json().catch(() => null);
    }
  } catch (err) {
    record(name, false, `network error: ${err.message}`);
    return null;
  }

  const okStatus = Array.isArray(expectStatus)
    ? expectStatus.includes(res.status)
    : res.status === expectStatus;

  if (!okStatus) {
    record(name, false, `${method} ${url} → HTTP ${res.status} (expected ${expectStatus})`);
    return null;
  }

  if (jsonShape && body && !jsonShape(body)) {
    record(name, false, `${method} ${url} → unexpected JSON shape: ${JSON.stringify(body).slice(0, 200)}`);
    return null;
  }

  record(name, true, `${method} ${url} → ${res.status}`);
  return body;
}

console.log(`smoke-app-dev base=${BASE}\n`);

// 1. Liveness: home page should respond (200 or 30x both fine).
await expect('home reachable', '/', {
  expectStatus: [200, 301, 302, 307, 308],
  parseJson: false,
});

// 2. Search — public, returns grouped results JSON.
await expect('search /api/v1/search?q=coffee', '/api/v1/search?q=coffee&tab=top&limit=5', {
  jsonShape: b => b && b.data && typeof b.data === 'object',
});

// 3. Search with no DB hits (empty query) returns the documented empty shape.
await expect('search empty q', '/api/v1/search', {
  jsonShape: b => b && b.data && Array.isArray(b.data.people),
});

// 4. Gift card claim lookup for a seeded dev token (PUBLIC GET).
await expect('gift card claim lookup', '/api/v1/gift-cards/claim/tch20off2026', {
  jsonShape: b =>
    b && b.data && b.data.template && b.data.template.claim_token === 'tch20off2026',
});

// 5. Gift card public claim page (server-rendered).
await expect('gift card claim page (HTML)', '/g/tch20off2026', {
  expectStatus: [200],
  parseJson: false,
});

// 6. Capsules — auth-required; we expect 401 (means handler reached, DB
//    table exists). 500/503 would mean schema gap.
await expect('capsules requires auth (200/401 ok)', '/api/v1/capsules', {
  expectStatus: [200, 401],
});

// 7. Gift card templates — auth-required; same shape check.
await expect('gift card templates requires auth (200/401 ok)', '/api/v1/gift-cards/templates', {
  expectStatus: [200, 401],
});

// 8. Gift card mine — auth-required; same shape check.
await expect('gift card mine requires auth (200/401 ok)', '/api/v1/gift-cards/mine', {
  expectStatus: [200, 401],
});

// 9. Auth session — public; either returns the user or { data: null }.
await expect('auth session', '/api/v1/auth/session', {
  jsonShape: b => b && 'data' in b,
});

// 10. User profile — try a known seeded user. 200 if exists, 404 if not yet
//     seeded on this env. Either is acceptable; 500 would indicate column
//     gap (the bug we just fixed).
await expect('user profile (200/404 ok, never 500)', '/api/v1/users/user_seed_01', {
  expectStatus: [200, 404],
});

// ── Summary ──────────────────────────────────────────────────────────────
const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) {
  console.error('\nFailures:');
  for (const f of failed) console.error(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}
