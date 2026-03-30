# LOCAL_CLAUDE.md — Gao Social V3

> Layer: **L1 — Workspace** (social coordination layer)
> This file adds to the global `CLAUDE.md`. Cannot override Section 0 rules.

## Session Context
```
Target layer:     L1 — Workspace (Gao Social)
Component:        Gao-social-v3 (Next.js 16 PWA)
Dependencies:     @gao/system-sdk (L3), Passkey/WebAuthn (L5), Payii (L4), GAR (L8)
Zone:             A (UI) — Zone C interfaces for auth/payment
Live layer risk:  yes — L4 (Payii) and L5 (Passkey) integrations, human sign-off confirmed
```

## dApp Contract
```
dApp name:              Gao Social
Owning layer:           L1
Target users:           Local discovery — people, businesses, events, agents
Primary primitive:      .gao domains, passkey, x402, GAR
SDK interfaces used:    sdk.identity.passkey, sdk.settlement.createIntent, sdk.browser.domain.resolve
Security zone:          A (UI), C (auth interface + types only)
Touches LIVE layer:     yes — L4 (Payii), L5 (Passkey) — human sign-off: yes
```

## Gao Ecosystem Integration
1. **Passkey Auth (L5)** — WebAuthn alongside email auth
2. **Payii Payment (L4)** — Bookings, event tickets, subscriptions
3. **.gao Domain (L5)** — DomainBadge in nav, user profiles
4. **GAR Agent (L8)** — "Ask Gao" powered by GAR streaming
5. **Audit Trail** — IronClaw compliant activity logging
6. **Design System** — Gao standard (cyan #00d4ff, glassmorphism, glow)
