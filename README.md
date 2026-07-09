# Agentic — SMM AI Engagement Platform

Fleet-scale social media engagement + own-content posting, built to the EngageOS
v1 spec. Generates human-sounding comments and captions across YouTube,
Instagram, and TikTok, guards a 50+ account fleet with a real safety layer, and
routes work to human agents (semi-auto: API where ToS allows, human paste via
AdsPower elsewhere).

> Product name **Agentic** is isolated to a single constant (`src/config/app.ts`)
> and `NEXT_PUBLIC_APP_NAME` — rebranding is a one-line change.

## Stack

- **Next.js 14** (App Router) — dashboard, agent console, studio, admin, API routes
- **Neon Postgres + Drizzle ORM** — schema, migrations, queries
- **pg-boss (on Neon Postgres)** — comment dispatch + scheduled-post publisher (no Redis)
- **Inngest** — cron jobs (watchlist polls, trend scans, digests, health recalc)
- **DeepSeek → Claude Sonnet** — AI provider with automatic fallback, JSON-out
- **Discord webhooks** — alerts, trend digests, fleet-health

## Build phases

| Phase | Scope | Status |
| ----- | ----- | ------ |
| **P1 — Core** | Schema, niche profiles (+SMM fields), Comment Studio + safety layer + banks, Caption Studio, agent console (manual flow), Discord alerts | ✅ Implemented |
| **P2 — Monitoring** | YT watchlist (RSS/API) full auto, IG/TikTok best-effort scrapers behind `SourceAdapter`, Trend Radar + digest | ✅ Implemented (YT RSS + Data API enrichment; IG/TikTok Apify adapter w/ circuit-breaker fallback; multi-source Trend Radar; hashtag approval; admin UIs) |
| **P3 — Scheduler** | Own-content posting: YT + IG Graph auto, TikTok reminder-fallback, media library | ✅ Implemented (real YouTube upload + IG Graph publish; media library w/ pluggable store; create→enqueue→publish pipeline + admin UI) |
| **P4 — Feedback** | Engagement sweep, what-works analytics, health tuning, YT auto-comment opt-in | ✅ Implemented (live YT metric re-poll + health signals; what-works dashboard; tone feedback loop; YT API auto-comment opt-in) |
| **P5 — Admin & Ops** | Login/auth (admin + agent), clients, per-agent run sheets, URL/activity log | ✅ Implemented (scrypt+session gate; admin control center; clients→agent assignment; operator "Today's run"; post/comment URL log) |

See [`docs/PHASES.md`](docs/PHASES.md) for the detailed per-phase breakdown and
what remains in each scaffolded module.

## Module map (`src/`)

```
config/        app name, platform list, default budgets/thresholds
env.ts         validated env + capability flags (graceful degradation)
db/            Drizzle schema, client, migrate + seed scripts
ai/            provider (DeepSeek→Claude fallback), JSON prompts (§7.1–7.4)
niches/        registry + ensureNicheProfile (seeds + LLM-generated)
safety/        simhash, banned-word scrubber, similarity guard, budgets,
               jitter windows, health score  (spec §6)
banks/         hashtag mixer (2+2+1, no-repeat-in-7-days)  (spec §8)
comment-studio/ generate (variants + pre-display safety) + record (final gate)
caption-studio/ generate (LLM copy + bank hashtags, never LLM tags)
monitoring/    SourceAdapter interface, YT RSS adapter, IG/TikTok scrape stub,
               poll orchestrator w/ circuit breaker  (spec §3, §5)
trends/        per-niche scan + Discord digest  (spec §7.3)
scheduler/     PostAdapter interface + per-platform adapters + publisher
agent-console/ round-robin alert assignment
analytics/     agent stats + engagement sweep
discord/       per-niche webhook routing
inngest/       client + all cron functions  (spec §5)
queue/         pg-boss connection, queues, worker (Postgres-backed)
```

## Getting started

```bash
npm install
cp .env.example .env        # fill in DATABASE_URL at minimum

# database
npm run db:push             # or: npm run db:generate && npm run db:migrate
npm run db:seed             # seed niches, demo agents/accounts, a YT watch target

# app
npm run dev                 # http://localhost:3000

# background workers (separate process; uses the same DATABASE_URL)
npm run worker

# inngest crons (local dev)
npm run inngest:dev
```

Only `DATABASE_URL` is required to boot. Missing keys degrade gracefully:
no AI key → generators error only when invoked; no database → dispatch logs
instead of enqueuing; no Discord webhook → notifications log to console; no
scraper → IG/TikTok targets drop to manual-refresh via the circuit breaker.

### Environment

All variables are documented in [`.env.example`](.env.example) and validated in
`src/env.ts`. Phase tags there indicate which key each phase needs.

## Safety layer (spec §6)

The part that keeps 50+ accounts alive, implemented in `src/safety/`:

1. **Fleet-wide similarity guard** — 64-bit SimHash, blocks near-dups vs (a)
   same video, (b) account's last 50, (c) fleet's last 48h.
2. **Banned-word scrubber** — global spam/compliance list + per-niche list +
   structural spam (URLs, @mentions, emails, phones, em-dashes).
3. **Per-account budgets** — randomized daily comment cap, min action gap.
4. **Timing jitter** — every alert gets a staggered comment window, never "now".
5. **Health score** — signals drop score → auto-cooldown → auto-pause + Discord.
6. **One-account-one-video** — max 1 fleet comment per video per niche.

Every generation path runs the scrubber + simhash pre-display; every posted
comment passes a second live safety gate in `comment-studio/record.ts`.

## Accounts, clients & the operator run sheet (P5)

The app is gated behind login (email + password, hashed with scrypt, signed
httpOnly session cookie). Two roles:

- **Admin** — the control center at `/admin`: create login users, add **clients**
  (brands) and assign each to one agent, set each client's platforms, edit the
  daily **run sheet** (per-platform comment quotas + time blocks), and view the
  **URL / activity log** (every logged post + commented-post URL). Admins also
  reach fleet health, watch targets, trend radar, scheduler, and analytics.
- **Agent** — `/run` is their "Today's run": quota meters that fill as they log
  actions, the admin-authored time blocks to check off, and a log-action form
  that records the target URL + the resulting comment/post URL.

First login uses the seeded admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD`); change the
password from **Admin → Users** after logging in. Set a strong `SESSION_SECRET`
in production.

Operator platforms (TikTok, Instagram, YouTube, Facebook, Reddit, GBP) are a
superset of the fleet-automation platforms — a client enables whichever apply,
and the run-sheet cards follow that selection.

## Deploy (Render + Neon)

No Redis required — the job queue (pg-boss) runs on the same Neon Postgres.

1. **Database (Neon):** create a project, then run [`schema.sql`](schema.sql) in
   the Neon SQL editor (or `psql "$DATABASE_URL" -f schema.sql`). It's idempotent.
   pg-boss creates its own `pgboss` schema automatically on first worker start.
2. **Render:** push the repo, then **New + → Blueprint** and select it —
   [`render.yaml`](render.yaml) provisions the web service + pg-boss worker with a
   shared env-var group. Fill the `sync: false` secrets (at minimum `DATABASE_URL`)
   in the Render dashboard; `ADMIN_API_TOKEN` is auto-generated.
3. **Crons:** register the deployed web URL in the Inngest dashboard and set
   `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY`. (Or use Render-native cron — see
   the commented block in `render.yaml`.)
4. Optionally `npm run db:seed` once to load demo niches/agents/accounts.

> Note: the worker polls Postgres for jobs, which keeps your Neon compute awake.
> On Neon's free tier that's fine; on paid tiers it means the compute won't
> autosuspend while the worker runs.

## Notes

- The `@/*` path alias resolves via `tsconfig.json`. `tsx` scripts (worker,
  seed, migrate) rely on tsx's tsconfig-paths support.
- Own-content upload calls (YT/IG/TikTok) and paid scrapers (Apify) are behind
  adapter interfaces — swap in live implementations without touching callers.
