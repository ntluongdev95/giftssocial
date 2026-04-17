# DEV Deployment — gao-social (Cloudflare Worker via OpenNext)

Dev-only CI/CD for the `develop` branch of `Gao-systems/Social-web`. Production
(`app.gao.social`, worker `gao-social`) is not touched by this pipeline.

## Branch model

- `master` — production. Not touched here.
- `develop` — dev auto-deploy branch. Only branch that triggers the dev worker deploy.
- Feature branches — PR into `develop`; do not auto-deploy.

## Cloudflare targets (dev only — inherited from existing wrangler.toml)

| Field | Value |
|---|---|
| Wrangler env | `dev` |
| Worker name | `gao-social-dev` |
| D1 binding `DB` | `gao-social-dev` |
| KV binding `SOCIAL_KV` | existing dev namespace |
| R2 binding `R2_BUCKET` | `gao-social-dev` |
| App URL | `https://app-dev.gao.social` (from `NEXT_PUBLIC_APP_URL`) |
| Compat date / flags | `2024-09-23` / `nodejs_compat` |

Production (not touched by this workflow): worker `gao-social`, route `app.gao.social`, D1 `gao-social-db`, R2 `gao-social-prod`.

## CI

Triggers on PR to `develop` and on push to `develop`.
Steps: `npm ci` → `npm run lint` → `npm run typecheck` → `npm run build` →
`npm run cf:build` → upload `.open-next/` artifact.

## Deploy

Runs only on push to `develop` when:
- `github.event_name == 'push'`
- `github.ref == 'refs/heads/develop'`
- `github.repository == 'Gao-systems/Social-web'`
- CI job succeeded (`needs: ci`)

Uses GitHub environment `development`. Downloads the CI artifact, runs a
preflight check for `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`, and
skips the deploy with a warning if either is missing. When both are set,
runs `npx wrangler@4 deploy --env dev`.

Concurrency: `dev-cicd-${github.ref}` with cancel-in-progress.

## Required GitHub secrets (on the `development` environment, NOT repo-wide)

| Name | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Wrangler auth. Least-privilege token. |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account id. |

## Required Cloudflare prerequisites

All pre-existing (already referenced in wrangler.toml):
- Worker `gao-social-dev`.
- D1 `gao-social-dev` (id `65f8c45c-b3d4-4f02-91b1-e6f828cc2e26`).
- KV namespace (id `49968b6c630147a284b3b2e93eec6422`).
- R2 bucket `gao-social-dev`.

API token scope (least privilege):
- `Account: Workers Scripts: Edit`
- `Account: Workers R2 Storage: Edit`
- `Account: D1: Edit`
- `Account: Workers KV Storage: Edit`
- `User: Memberships: Read`

## Required GitHub manual settings

Branch protection on `develop`:
- Require PR before merging.
- Required status check: `dev-cicd (gao-social) / CI (lint + typecheck + build)`.
- Disallow force-push and deletion.

Environment `development`:
- Deployment branches: `develop` only.
- Required reviewers: at least one maintainer.
- Secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.

## Verification

1. GitHub → Actions → confirm `ci` passed, then `deploy` passed.
2. Cloudflare dashboard → `gao-social-dev` deployment matches commit SHA.
3. Curl the dev worker's default URL or `https://app-dev.gao.social` if route bound.

## Rollback

- Cloudflare dashboard → `gao-social-dev` → Deployments → Rollback, or
- Revert bad commit on `develop` and push.

## What is intentionally NOT automated

- Production deploys (`gao-social` worker, `app.gao.social`).
- Deploys from PRs (forks would leak secrets).
- Creation of the `development` environment or secrets.
- Any `.vercel/` deploy path — ignored by this workflow.
