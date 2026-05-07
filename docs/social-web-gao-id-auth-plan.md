# Gao ID Canonical Login — Integration Plan

**Status**: Phase 0 — planning only. No runtime code change in this commit.
**Owners**: social-web team + gao-id-worker ops
**Last reviewed**: 2026-05-07

This document is the source-of-truth plan for adding Gao ID canonical
identity to social-web **alongside the existing Google/Apple bootstrap
login**. Bootstrap login is a permanent feature; Gao ID is an additive
canonical layer. It is committed intentionally before any runtime change
so future phases can be reviewed against a stable spec.

---

## 1. Architecture in one paragraph

> **Bootstrap authentication is a permanent social-web login layer.
> Google/Apple/social login must remain supported for normal social-web
> usage; Gao ID is an additional canonical identity layer required only
> for Gao Profile, wallet/domain ownership, trust/verification, and
> payment/official-identity actions.**

social-web has **two coexisting auth layers**:

1. **Bootstrap layer** (Google / Apple / social) — stays. It creates a
   social-web account, mints a social-web HS256 JWT, and lets users use
   the social-web app: feed, search, signals, capsules, location-share,
   nearby, etc. This account is purely a social-web local account. It
   does **not** confer canonical Gao identity.
2. **Canonical Gao ID layer** — issued exclusively by **gao-id-worker**
   after the user connects an EVM wallet (GaoKey / WalletConnect / EOA)
   and signs a SIWE (EIP-4361) message. Returns an ES256 Bearer plus a
   `rootId`. All Gao-canonical reads/writes (profile, .gao domain,
   wallet ownership, trust, payments, official identity) go through
   this layer.

Bootstrap users without Gao ID see "Signed in with Google · Gao ID: Not
connected" and a CTA "Connect GaoKey / Wallet to activate Gao ID".
Bootstrap users keep using all non-Gao-canonical features normally.

```
                           ┌──────────────────────────┐
   Anonymous ─Google────▶  │ BOOTSTRAP_AUTHENTICATED  │ ◀── full social-web UX
                           │ (social-web session)     │     (feed, signals, capsules…)
                           └──────────┬───────────────┘
                                      │ click "Connect GaoKey"
                                      ▼
                           ┌──────────────────────────────┐
                           │ WALLET_CONNECTED_NOT_VERIFIED│
                           └──────────┬───────────────────┘
                                      │ user signs SIWE → /v2/auth/verify
                                      ▼
                           ┌────────────────────────────────────────┐
                           │ GAO_ID_AUTHENTICATED                   │
                           │ (ES256 Bearer in memory, rootId known) │
                           │ provider_links row: bootstrap ↔ root   │
                           └──────────┬─────────────────────────────┘
                                      │ GET /v1/me/profile
                                      ▼
                          ┌───────────┴────────────┐
                          │ profile.displayName ?  │
                          └─┬──────────────────┬───┘
                            │ null             │ set
                            ▼                  ▼
                      Gao Profile          Gao Profile
                      missing → modal      active → unlock
```

---

## 2. Source-of-truth references

- **Issuer (Gao ID Worker)**: GitHub `dev-gao-core/gao-id-worker`
  (private), default branch `main`. Files of interest:
  - `src/routes/auth-v2.ts` — `/v2/auth/{nonce, verify, refresh, logout, me}`
  - `src/routes/jwks.ts` — `/.well-known/jwks.json`
  - `src/routes/me.ts`, `me-v2.ts`, `profile.ts` — bearer-protected
    canonical profile endpoints under `/v1/me/*`
  - `wrangler.toml` — TEST tier vars (allowlists, chain IDs, audience)
  - `docs/auth/AUTH_*.md`, `docs/gao-id/*.md` — protocol docs
- **Frontend (social-web)**: GitHub `Gao-systems/Social-web`, branch
  `develop`. Deploy chain: push → workflow `dev-cicd (gao-social)` →
  `wrangler deploy --env dev` → Cloudflare worker `gao-social-dev` →
  custom domain `app-dev.gao.social`. GitHub Actions is the only
  deploy path; no local deploy.

> Local Desktop folders (`~/Desktop/gao-id-worker`, `gao-id-dev-kit`,
> etc.) are NOT source of truth — they may be stale clones. All
> conclusions in this plan cite the GitHub remote on the canonical
> branches above.

---

## 3. Issuer endpoints (canonical contract)

From `dev-gao-core/gao-id-worker@main`:

| Method | Path | Notes |
|---|---|---|
| POST | `/v2/auth/nonce` | `{ address, chainId }` → `{ nonce, expiresAt }`. Rate-limit 30/min. |
| POST | `/v2/auth/verify` | `{ message, signature }` → `{ accessToken, expiresIn, csrfToken, user }`. Sets HttpOnly `gao_refresh` cookie scoped to `/v2/auth/refresh` (and a duplicate at `/v2/auth/logout`). Rate-limit 10/min. |
| POST | `/v2/auth/refresh` | `credentials: 'include'`. Rotates refresh family, mints new access + csrf. CSRF double-submit is **no-op server-side as of `auth-v2.ts` head comment**; the security model is HttpOnly refresh cookie + strict Origin allowlist (`originGuard`). The `csrfToken` field is still returned for backward-compat. |
| POST | `/v2/auth/logout` | Revokes refresh family, clears cookies. |
| GET | `/v2/auth/me` | Bearer-only: `{ rootId, walletAddress, chainId }`. Lightweight probe. |
| GET | `/.well-known/jwks.json` | ES256 JWKS, `cache-control: max-age=300`. |
| GET | `/v1/me/profile` | Bearer. Canonical profile shape — `{ rootId, displayName, bio, avatarUrl, website, location, socialX, socialTg, metadata, version, ... }`. |
| PUT | `/v1/me/profile` | Bearer. Partial update. |
| GET | `/v1/me/domains`, `/v1/me/domain-summary` | Bearer. Domain ownership. |

JWT shape:
- `alg: ES256`, `kid` per env (TEST: `gao-id-test-2026-04`)
- `iss`: issuer origin (e.g. `https://id-test.gao.domains`)
- `aud`: gateway audience (e.g. `https://api-test.gao.domains`)
- `sub`: `rootId`

---

## 4. Tier topology

| Env | Issuer origin | API audience | Config source |
|---|---|---|---|
| DEV | `https://id-dev.gao.domains` | `https://api-dev.gao.domains` | private ops repo (status not yet confirmed) |
| TEST | `https://id-test.gao.domains` | `https://api-test.gao.domains` | `wrangler.toml@main` of `dev-gao-core/gao-id-worker` |
| PROD | `https://id.gao.domains` | `https://api.gao.domains` | private ops repo |

**Open question for ops** (Section 12): Is `id-dev.gao.domains`
currently live? If not, social-web `app-dev.gao.social` will need to
target TEST tier as a transitional step.

---

## 5. Current allowlists (TEST tier — `wrangler.toml@main`)

```
SIWE_DOMAIN     = "test.gao.domains, test-explorer.gao.global"
SIWE_URI        = "https://test.gao.domains"
ALLOWED_ORIGINS = "https://test.gao.domains,
                   https://test-explorer.gao.global,
                   https://test-store.gao.global,
                   http://localhost:3000"
CHAIN_ID_ALLOWLIST = "1, 10, 56, 97, 137, 8453, 42161, 84532,
                      421614, 11155111, 11155420"
```

`app-dev.gao.social` is not in `SIWE_DOMAIN` nor `ALLOWED_ORIGINS`.
Until ops adds it, social-web cannot complete a SIWE flow against the
TEST issuer. See Section 10 for the exact ops-side change request.

---

## 6. social-web current state (informational)

Auth implementation summary as of `develop@8b217a2`. **Everything below
is the bootstrap layer and stays in place; this section is description,
not deprecation.**

- **Bootstrap login**: hand-rolled Google OAuth 2.0 authorization-code
  flow. Files: `src/components/ui/AuthPopup.tsx`,
  `src/app/api/v1/auth/google/route.ts`, callback at
  `src/app/api/auth/google/callback/page.tsx`. Apple Sign-In is a
  placeholder.
- **Bootstrap session**: social-web mints its own **HS256** JWT
  (`jose`, `JWT_SECRET` shared symmetric secret). Access TTL 30 days,
  refresh 90 days. See `src/lib/jwt.ts`. This continues to be valid
  for bootstrap-scope app features.
- **Bootstrap cookies**: `gao_token` (HttpOnly), `gao_refresh`
  (HttpOnly), `gao_logged_in='1'` (NOT HttpOnly — UI flag).
  `SameSite=lax`. Set on social-web origin only. See
  `src/lib/auth-cookies.ts`.
- **Bootstrap state**: zustand `useAuthStore` with `setTokens` that
  **also writes `localStorage.access_token`** — this part is a
  documented violation (see Section 13) and will be removed in Phase 2.
- **Bootstrap hydration**: `AuthHydrator.tsx` calls
  `/api/v1/auth/session` on mount.
- **Bootstrap users table**: `users` in `schema-d1.sql` carries some
  fields that are about to become **read-only** for canonical reads
  (`display_name`, `avatar_url`, `gao_domain`, `trust_score`,
  `trust_level`, `badges`, `wallet_address`). The bootstrap layer must
  stop *writing* these from Google/Apple data. They become "legacy
  cache" columns that Phase 4 makes read-only and Phase 5 may drop or
  rename.
- **No web3 deps** yet: `package.json` lacks `wagmi`, `viem`, `ethers`,
  `siwe`, `@reown/*`, `@walletconnect/*`. `firebase` is an orphan
  dependency (FCM was removed); confirmed 0 active imports — slated
  for cleanup unrelated to this plan.

---

## 7. Terminology

To avoid confusion across phases:

| Term | Meaning |
|---|---|
| **Bootstrap user** | The social-web local account, identified by `users.id` (e.g. `user_abc...`). Created on first Google/Apple login. Has email, display name (local cache), social-web preferences. **Stays forever.** |
| **Bootstrap session** | The social-web HS256 JWT + cookies set on social-web origin. Authorizes access to social-web app features. **Stays forever.** |
| **Gao root / `rootId`** | The canonical Gao identity. Wallet-agnostic, one per human. Issued by gao-id-worker on first successful SIWE for a wallet. Carries the Canonical Profile, domain ownership, payment identity, trust score. |
| **Gao ID Bearer** | The ES256 JWT minted by gao-id-worker. Memory-only on the client. Authorizes Gao-canonical reads/writes (`/v1/me/*`, gateway endpoints). |
| **Canonical Profile** | The profile fields stored at the issuer (`/v1/me/profile`). Owned by Gao ID, never owned by bootstrap. |
| **`provider_links`** | Bridge table linking a bootstrap user to a Gao root after SIWE. Written from social-web. |
| **Gao-gated feature** | A feature that requires Gao ID Bearer (Gao Profile, .gao domain, payments, trust badge, official identity). Hidden behind `<GaoIdGate>` for bootstrap-only users. |

The current `useAuthStore` will be renamed/relabeled (Phase 2) to
`useBootstrapAuthStore` to make the layering obvious. A separate
`useGaoIdStore` will hold canonical state.

---

## 8. Linking model

Bootstrap and Gao root are linked via a new table written by social-web:

```sql
-- migration-006-gao-id-link.sql (Phase 3, NOT in this commit)
CREATE TABLE IF NOT EXISTS provider_links (
  id                 TEXT PRIMARY KEY,         -- 'plnk_' + hex(randomblob(16))
  bootstrap_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  gao_root_id        TEXT NOT NULL,            -- canonical from gao-id-worker
  provider           TEXT NOT NULL,            -- 'google' | 'apple' | 'siwe'
  provider_subject   TEXT NOT NULL,            -- google sub / apple sub / wallet addr lowercase
  linked_at          TEXT NOT NULL DEFAULT (datetime('now')),
  unlinked_at        TEXT,
  UNIQUE (provider, provider_subject) WHERE unlinked_at IS NULL,
  UNIQUE (bootstrap_user_id, gao_root_id)
);
CREATE INDEX idx_provider_links_root ON provider_links(gao_root_id);
CREATE INDEX idx_provider_links_user ON provider_links(bootstrap_user_id);
```

Linking rules:

- First Google login → `users` row created. **No canonical fields
  filled.** No SIWE attempted automatically. User can use bootstrap
  features immediately.
- First successful SIWE → if a bootstrap session exists in this
  browser, a `provider_links` row binds bootstrap user ↔ rootId. If no
  bootstrap session, social-web creates a thin bootstrap user
  identified only by the rootId (so app account exists for local
  prefs).
- If the same wallet has previously been linked to a different
  bootstrap user (different Google account), **block** with an
  account-conflict UI. No silent merge.
- If the same Google `provider_subject` is already linked to a
  different rootId, **block** the SIWE. (Prevents takeover via
  re-login.)
- `unlinked_at` allows an explicit user-initiated unlink for migration
  scenarios; the unique constraint applies only to active links.
- Google email is **never** used as proof of wallet/domain/profile
  ownership.

---

## 9. State machine

```
ANONYMOUS                        no bootstrap cookie
   │ Google sign-in
   ▼
BOOTSTRAP_AUTHENTICATED          social-web cookie + bootstrap user row
   │                             ── full social-web UX is enabled here ──
   │ click "Connect GaoKey"
   ▼
WALLET_CONNECTED_NOT_VERIFIED    wagmi connected, no SIWE yet
   │ user signs SIWE → /v2/auth/verify → 200
   ▼
GAO_ID_AUTHENTICATED             ES256 Bearer in memory; provider_links row created
   │ GET /v1/me/profile
   ▼
GAO_PROFILE_MISSING              profile.displayName === null → CreateProfileModal
   │ PUT /v1/me/profile
   ▼
GAO_PROFILE_ACTIVE               Gao-gated feature unlock (domains, payments, signals)

AUTH_ERROR                       any 401/403/replay → reset Gao ID memory only,
                                 BOOTSTRAP_AUTHENTICATED state retained
```

Edges:

- Bootstrap cookie expires → fall to `ANONYMOUS`. If a Gao ID Bearer was
  in memory and is still un-`exp`'d, it stays valid until then; on
  refresh failure (no bootstrap cookie not strictly required for Gao ID
  refresh, since `gao_refresh` lives at the issuer origin) the user is
  in `AUTH_ERROR`.
- User logs out of bootstrap → also call `POST /v2/auth/logout` to
  revoke the Gao ID refresh family; clear in-memory Bearer.
- User logs out of Gao ID only → keep bootstrap session; UI shows
  "Gao ID: Not connected" with reconnect CTA.
- Wallet disconnect mid-session → state remains
  `GAO_PROFILE_ACTIVE` until Bearer `exp`; on refresh attempt, if
  `gao_refresh` cookie is still valid, refresh succeeds without wallet
  signature (cookie-based refresh is the design).

---

## 10. Required ops change (gao-id-worker side)

Before social-web can complete any SIWE flow, the issuer must allow
`app-dev.gao.social` as both a SIWE domain and a CORS origin. Submitted
as a **separate ops request** — not part of this docs-only commit.

Target file: `wrangler.toml` of the deployed DEV (or TEST) tier of
gao-id-worker (DEV tier config in private ops repo;
`dev-gao-core/gao-id-worker@main` is the TEST tier reference).

Diff (TEST tier example):

```diff
 # wrangler.toml [vars]
-SIWE_DOMAIN     = "test.gao.domains,test-explorer.gao.global"
+SIWE_DOMAIN     = "test.gao.domains,test-explorer.gao.global,app-dev.gao.social"

-ALLOWED_ORIGINS = "https://test.gao.domains,https://test-explorer.gao.global,https://test-store.gao.global,http://localhost:3000"
+ALLOWED_ORIGINS = "https://test.gao.domains,https://test-explorer.gao.global,https://test-store.gao.global,https://app-dev.gao.social,http://localhost:3000"
```

Equivalent for DEV tier in private ops repo if DEV is the chosen
target.

Reown / WalletConnect dashboard also needs `https://app-dev.gao.social`
added to the allowed origins for project ID
`1f9bda5b575c0b739f22efe059a5d10c` (canonical Gao project ID — never
hardcode fallbacks).

---

## 11. Roll-out phases (revised)

Bootstrap login is **never removed**. Each phase ships as small
commits, diff-first.

| Phase | Scope | Gate to next phase |
|---|---|---|
| **0** (this commit) | Plan committed; no runtime change. | Plan approved. |
| **1** | gao-id-worker ops change: add `app-dev.gao.social` to `SIWE_DOMAIN` + `ALLOWED_ORIGINS` (DEV or TEST tier). Reown dashboard origin add. social-web GitHub Environment Variables added: `NEXT_PUBLIC_GAO_ID_API`, `NEXT_PUBLIC_GAO_ID_SIWE_DOMAIN`, `NEXT_PUBLIC_GAO_ID_AUDIENCE`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`. No social-web code change yet. | Issuer reachable from `app-dev.gao.social` origin (verified via curl with manual Origin header). |
| **2** | Add Gao ID layer to social-web **behind feature flag** `NEXT_PUBLIC_GAO_ID_ENABLED=false`: install web3 deps (`wagmi`, `viem`, `@reown/appkit`, `@reown/appkit-adapter-wagmi`, `siwe` or hand-rolled), add `src/lib/gao-id/*`, `src/stores/gao-id-store.ts`, `src/providers/Web3Provider.tsx`. Rename `useAuthStore` → `useBootstrapAuthStore` (semantic-only). Remove `localStorage.access_token` write + add cleanup in `AuthHydrator`. **Bootstrap login behavior unchanged.** | Internal smoke-test: feature flag on for admins → Connect Wallet → SIWE → Bearer minted → `/v1/me/profile` reachable. |
| **3** | Wire UI: `ConnectWalletSheet`, `SiweSignSheet`, `GaoIdGate`, `CreateProfileModal`. Add "Gao ID: Not connected / Connected" indicator next to bootstrap user chip. Add migration 006 (`provider_links` table). Implement linking + conflict rules (Section 8). Still flag-gated. | Internal admin pool confirms full flow + conflict UI. |
| **4** | Public flag-on rollout. Mark canonical fields in `users` (`display_name`, `avatar_url`, `gao_domain`, `trust_score`, `trust_level`, `badges`, `wallet_address`) as **read-only legacy cache**: app code stops writing them; reads prefer `useGaoIdStore.profile` and fall back to `users.*` only if no Gao ID linked. Gate Gao-canonical features behind `<GaoIdGate>`. **Bootstrap login still works for non-canonical features.** | Read-path verified for all features; bootstrap-only users still functional. |
| **5** | Schema cleanup (optional, requires data audit): drop or rename deprecated columns to `legacy_*`. Remove `firebase` orphan dep. Add `/api/v1/build` endpoint (deploy verification — tracked in deployment audit follow-up). **Bootstrap login still preserved.** | — |

> Phase 4 does NOT remove `/api/v1/auth/google`, the bootstrap session
> route, or the `users` table. Bootstrap is a permanent feature.

---

## 12. Open questions (need answers before Phase 1)

1. Is `id-dev.gao.domains` currently deployed and reachable? If yes,
   from which repo? If no, is TEST tier (`id-test.gao.domains`) the
   correct target for `app-dev.gao.social` in the interim?
2. Who has merge rights on the private ops repo holding DEV/PROD
   `wrangler.toml` for gao-id-worker?
3. Has Reown project ID `1f9bda5b575c0b739f22efe059a5d10c` been updated
   to allow `https://app-dev.gao.social` as a valid origin?
4. Apple Sign-In bootstrap entry — implement in Phase 2/3 or stay
   Google-only? (Bootstrap layer can grow without affecting Gao ID
   model.)
5. Avatar upload — does Gao ID expose an upload endpoint backed by
   `R2_AVATAR`, or does the FE PUT to a presigned URL? Need API spec
   before `CreateProfileModal` is built.
6. What is the Gao ID rule when a wallet is bound to a rootId but the
   user later signs SIWE from a different bootstrap account? Confirmed
   block — but should the UI offer an explicit "transfer bootstrap
   link" path or just deny?

---

## 13. Storage rules (mandatory)

| Artifact | Where | Rationale |
|---|---|---|
| Gao ID `accessToken` (ES256) | JS memory only (zustand `useGaoIdStore`, no persist) | XSS-resistant, short-lived |
| Gao ID `csrfToken` (legacy) | JS memory only | Forward-compat; no longer enforced server-side |
| `gao_refresh` cookie | Browser HttpOnly cookie at issuer origin | App never touches it |
| Bootstrap social-web JWT | HttpOnly cookie at social-web origin (existing) | Bootstrap layer is unchanged |
| `gao_logged_in='1'` flag cookie | Existing non-HttpOnly cookie | UI hint only; no security claim |
| `localStorage.access_token` | Removed in Phase 2 | Currently violates Gao ID rule and is unnecessary even for bootstrap |

Bootstrap session and Gao ID Bearer are **independent**: clearing one
does not clear the other. Logout flows must explicitly handle both.

---

## 14. UX requirements

- Header / profile chip after Google login:
  - Top line: `Signed in with Google` (bootstrap name/avatar from
    Google profile, or generic if user removed it later).
  - Sub line: `Gao ID: Not connected` with chevron-CTA "Connect GaoKey
    / Wallet to activate Gao ID".
- After SIWE success:
  - Sub line becomes: `Gao ID: <rootId tail or .gao name>` with green
    badge.
  - If `profile.displayName === null` → small banner "Finish your Gao
    Profile" → opens `CreateProfileModal`.
- Gao-gated UI patterns (wrapped by `<GaoIdGate>`):
  - Profile page (canonical view of self)
  - .gao domain ownership / primary domain section
  - Wallet ownership claim
  - Trust score / verification badges
  - Payment-sensitive flows (booking checkout, capsule with payment,
    tipping, etc.)
- Non-gated UI continues normally without Gao ID:
  - Feed / search / nearby / map
  - Reading signals / capsules (no payment)
  - Posting non-payment social content (per product call: may also
    require Gao ID; flag in Phase 3)
- Account conflict UI: explicit "This wallet is already linked to a
  different Gao account. Sign in with that account or unlink first."
  (No automatic merge.)
- Logout: two buttons — "Sign out of Gao ID" (clears Bearer + calls
  `/v2/auth/logout`) and "Sign out of social-web" (clears both layers).

---

## 15. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Allowlist PR not merged in time | All SIWE blocked | Phase 2 ships with feature flag off; only flip on after allowlist confirmed |
| DEV tier of gao-id-worker not live | Shared TEST data with other clients | Document tier choice in `NEXT_PUBLIC_GAO_ID_API`; isolate test users |
| Third-party cookie restrictions (Safari ITP, future Chrome) | Refresh cookie not sent cross-origin | Test on Safari incognito + Chrome with 3PC blocking; consider token-bound or first-party pattern in Phase 5 |
| Multi-tab refresh race → `replay` revoke | Gao ID logged out across tabs (bootstrap untouched) | Single-flight refresh promise + `BroadcastChannel('gao-id-auth')` for cross-tab coordination |
| `localStorage.access_token` leftovers from old build | XSS exposure on bootstrap token | `AuthHydrator` Phase 2 calls `localStorage.removeItem('access_token')` once; tracked separately |
| Bootstrap email != wallet owner | Account takeover attempt | Provider link uniqueness + UI conflict on collision (Section 8) |
| Canonical profile read failure (issuer down) | Gao-gated UI broken | SWR with stale-while-revalidate; bootstrap layer remains functional |
| User cancels SIWE mid-flow | Partial state | State machine collapses back to `BOOTSTRAP_AUTHENTICATED`; nonce expires server-side |

---

## 16. Out of scope for Phase 0

- All runtime code in `src/`, `schema-d1.sql`, `wrangler.toml`,
  `package.json`, `.github/workflows/`.
- Any change to gao-id-worker repo (handled via separate ops request).
- Production OAuth client config (Phase 2+ may revisit prod
  separately).
- `.env.production.local` removal (tracked in deployment audit; later
  cleanup phase).
- Apple Sign-In implementation.
- `/api/v1/build` endpoint for deploy verification (deployment audit
  follow-up).
- Removal of any bootstrap-layer code.

---

## 17. Approvals required to advance to Phase 1

- [ ] gao-id-worker ops PR adds `app-dev.gao.social` to `SIWE_DOMAIN`
      and `ALLOWED_ORIGINS` in DEV (or TEST) tier wrangler config.
- [ ] Reown dashboard updated with `https://app-dev.gao.social` as
      allowed origin for project `1f9bda5b575c0b739f22efe059a5d10c`.
- [ ] Tier choice confirmed (DEV vs TEST) and corresponding
      `NEXT_PUBLIC_GAO_ID_*` env vars set as GitHub Environment
      Variables for `dev-cicd` workflow.
- [ ] Phase 2 PR ships behind feature flag; flag stays OFF until ops
      items above are signed off.
