# CLAUDE — GAO SOCIAL V3

## Master Context File for AI-Assisted Development

### Stack: Next.js PWA · MapLibre GL · MongoDB · Redis · WebSocket · Payii

### Version: 3.0.0 | Toii Labs LLC / Gao Workspace LLC

---

## IDENTITY & POSITIONING

Gao Social V3 is a **map-first, real-time social coordination platform** and **AI-native execution network**. It is NOT a social feed, NOT a chatbot wrapper, NOT a listings directory.

**Core formula:**
```
Old social   = content + algorithm + ads
Gao Social   = world map + signals + trust + AI agents + action
```

**Primary KPIs — measure these, nothing else:**
- Actions completed (bookings, joins, payments, proofs)
- Connections made
- Merchant signals published
- Agent executions with receipts

**Never optimize for:** time spent, impressions, feed scroll depth.

---

## PRODUCT RULES — INVIOLABLE

```
RULE 1: No feed. Home screen is ALWAYS a live map. Never a post timeline.
RULE 2: Core object is Signal, NOT Post. Never introduce "post" as a primitive.
RULE 3: Every discovery surface must show trust indicators.
RULE 4: Every meaningful action must produce a receipt or proof.
RULE 5: Agents are first-class entities. NOT chatbot widgets.
RULE 6: No banner ads. No sponsored feed. No attention monetization.
RULE 7: Empty state is forbidden. Seed data must be present at all times.
RULE 8: If a feature doesn't improve discovery, trust, or action → deprioritize.
```

---

## NAVIGATION ARCHITECTURE

```
Bottom Nav (always visible, 5 tabs):
[ World ] [ Nearby ] [ Circles ] [ Actions ] [ Me ]
```

---

## TECH STACK

```
Frontend: Next.js 14+ (App Router), TypeScript (strict), Tailwind CSS, MapLibre GL JS, Zustand, SWR, Framer Motion, PWA
Backend: Node.js, PostgreSQL + MongoDB + Redis (hybrid)
Integrations: Payii API, Gao Domain API, Anthropic API claude-sonnet-4-6
```

---

## DATABASE — HYBRID

```
PostgreSQL: users, businesses, circles, circle_members, events, event_attendees, bookings, payments, proofs, trust_reports, moderation_actions, notifications
MongoDB: signals (2dsphere + TTL), agents, agent_actions
Redis: sessions, geo cache, pub/sub, rate limits
```

---

## DESIGN SYSTEM

```
Colors: navy #0A1628, cyan #00C2E0, slate #1E3A5F, steel #2D5F8A
Entity: people #3B82F6, business #22C55E, event #EF4444, offer #EAB308, agent #A855F7
Trust: new=gray, verified=blue, trusted=green, highly_trusted=gold
Font: Inter (body), dark UI, cards with backdrop-blur
```

---

## ANTI-PATTERNS — NEVER DO

```
❌ Home screen is a feed
❌ "Post" as a UI label
❌ Banner ads
❌ AI agent as bottom-sheet chatbot
❌ Agent actions without receipts
❌ Empty map with no signals
❌ "Feed" tab in navigation
```
