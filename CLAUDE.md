# CLAUDE.md — Gao Social

> Read this file completely before doing anything.
> Every code change, build, and deploy decision must follow this file.
> If anything is unclear, stop and report evidence instead of guessing.

---

## 0. CORE RULES

1. Audit first. Patch second.
   - Do not edit code until you have identified the exact active runtime codepath.
   - Do not assume a file is active just because it exists.

2. Never guess.
   - If you are unsure, inspect and report.
   - If a referenced file/path does not exist, stop and say so.

3. Do not claim success from source changes alone.
   - Runtime bugs are only considered fixed after build output and deployed output are verified.

4. Prefer minimal, surgical changes.
   - Do not refactor unrelated code.
   - Do not touch unrelated repos, caches, or filesystem paths outside this project unless explicitly required for the task.

5. Preserve security and correctness.
   - Do not remove auth checks, validation, or safety logic just to make the bug "go away".
   - Do not weaken cookie security, token checks, or session validation without explicit approval.

6. No fake completion.
   - "Build succeeded" is not enough.
   - "Deploy succeeded" is not enough.
   - You must prove the runtime actually contains the intended fix.

---

## 1. REQUIRED START SEQUENCE — EVERY SESSION

Before touching anything:

1. Read this `CLAUDE.md`
2. Inspect project scripts in `package.json`
3. Report:
   - package manager actually used
   - available scripts for:
     - typecheck
     - lint
     - test
     - build
     - deploy
4. Identify:
   - current branch
   - latest commit hash
   - target environment for this task
   - target URL/domain for verification

Then output a short PLAN and wait if the task is ambiguous.
If the task is clear and low-risk, proceed directly but still print the PLAN first.

---

## 2. MANDATORY PLAN FORMAT

Before edits, output:

- Files read
- Exact files to modify
- Exact files not to touch
- Whether config/package/lockfile changes are needed
- Exact validation commands that will be run
- Exact deploy target
- Exact runtime URL that will be tested

Do not expand scope silently.

---

## 3. RUNTIME BUG RULES

For any runtime/UI/auth bug, you must verify the **active runtime path**, not just source files.

Mandatory audit steps:

1. Identify the exact user action path
   - button/component/page
   - click handler
   - hook/store/helper
   - auth gate / redirect / modal logic

2. Identify every source of truth involved
   - localStorage
   - cookies
   - Zustand/store/in-memory state
   - `/auth/me`
   - `/api/auth/session`
   - service worker cached state
   - derived UI flags like `isAuthenticated`, `isHydrated`, etc.

3. Mark each codepath as:
   - active in current build
   - dead/legacy
   - uncertain

4. Explain the root cause with evidence
   - exact file
   - exact function
   - exact broken assumption

Do not patch before completing this analysis unless the task explicitly says to skip audit.

---

## 4. AUTH BUGS — SPECIAL RULES

For any login/session/authentication issue:

1. Trace both:
   - login success write path
   - protected action read path

2. Verify whether auth state is written and read from the same source of truth.

3. Explicitly check for split-brain auth:
   - login writes Zustand only
   - feature reads localStorage only
   - cookie exists but UI store is empty
   - hydration not completed before auth gate runs

4. Check refresh/cold-load behavior.
5. Check Android Chrome specifically if the bug mentions Android Chrome.
6. Do not "fix" by adding duplicate token writes everywhere unless justified.

---

## 5. BUILD RULES

For any change meant to fix runtime behavior:

1. Do not trust previous build artifacts.
2. Do not reuse stale `.open-next/` or `.next/`.
3. Before rebuild, remove stale build output relevant to this repo.
4. Then run the actual build command from `package.json`.
5. If the build system is OpenNext/Next.js, verify generated bundle output, not just source.

If a clean rebuild is needed, prefer this order unless project-specific scripts say otherwise:

```bash
rm -rf .open-next
rm -rf .next
rm -rf node_modules/.cache
```

Then run the proper build command.

Do not delete `node_modules` unless actually necessary.

---

## 6. BUILD / DEPLOY VALIDATION RULE — MANDATORY

After every build that is meant to fix a runtime bug, prove that the new bundle contains the fix before deploy.

Minimum required validation:
1. Search the built output for the old broken code pattern and confirm it is gone
2. Search the built output for the new fixed code pattern and confirm it is present
3. Only then deploy
4. After deploy, verify the served runtime is using that new bundle

Never claim success from source changes alone.
Never trust stale `.open-next/`, `.next/`, or cached artifacts.

**Required sentence:**

> After build, prove that the new bundle contains the fix by searching for the old code pattern and confirming it is gone.

**Required proof format:**

For runtime bug fixes, always show:
- exact search command used
- exact output
- conclusion from that output

Example pattern:
- old broken pattern: `localStorage.getItem("access_token")`
- new fixed pattern: project-specific replacement logic

If the old broken pattern is still present in the active built chunk, the fix is NOT complete.

---

## 7. DEPLOY RULES

1. State the exact deploy command before running it.
2. State the exact target environment:
   - dev / staging / prod
3. State the exact URL/domain expected to serve the result.
4. Do not say "production" if deploying only to workers.dev.
5. If custom domain routing is relevant, verify it explicitly.
6. If the user says they tested on a specific URL, that URL is the primary truth target.

---

## 8. POST-DEPLOY VERIFICATION RULES

After deploy, verify the actual runtime:
1. Confirm deployed commit hash if possible
2. Confirm target URL
3. Confirm the served bundle/chunks are updated
4. Check service worker behavior if one exists
5. For client-side fixes, test the real interaction path again

If you cannot verify the live runtime, say so explicitly.
Do not imply certainty you do not have.

---

## 9. OUTPUT FORMAT FOR BUGFIX TASKS

Use this exact structure:
1. Audit findings
2. Root cause
3. Files to change
4. Diff plan
5. Commands run
6. Build proof
7. Deploy result
8. Runtime verification
9. Remaining risks
10. Final verdict

Keep it concise, evidence-based, and technical.

---

## 10. WHAT NOT TO DO

Do NOT:
- claim success from source diff alone
- skip bundle verification
- skip deploy target verification
- patch dead code and call it fixed
- mix unrelated fixes into the same change
- hide uncertainty
- use "probably fixed" language without evidence

---

## 11. GIFT AUTH BUG — PROJECT MEMORY

Known class of bug in this repo:
- User is already logged in
- Gift flow still asks user to log in again

Common failure pattern:
- login success writes auth state to one place
- Gift flow reads auth state from another place
- or deployed bundle is stale and still contains old auth gate code

For this class of bug, always verify:
- active Gift click handler
- active auth gate
- login success write path
- built chunk contents
- deployed chunk contents

---

## 12. DEFAULT SUCCESS CRITERIA

A runtime auth bug is only considered fixed if all are true:
- source patch is correct
- built bundle contains the patch
- old broken pattern is absent from built output
- deployed runtime serves the new bundle
- real user flow passes on the target URL

If any one of these is missing, the task is not complete.
