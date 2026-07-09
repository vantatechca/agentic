# Build Phases — detailed breakdown

This document tracks the phased build (spec §11) and what remains in each
scaffolded module. Phase 1 is fully implemented; P2–P4 are scaffolded behind
adapter interfaces so live implementations slot in without refactoring callers.

## P1 — Core ✅ (implemented)

- [x] **Schema** (`src/db/schema.ts`) — all tables from spec §4: niches,
      accounts, watch_targets, alerts, comments, captions, scheduled_posts,
      trends, agents, engagement_log, + account_health_events audit trail.
- [x] **Niche profiles** (`src/niches/`) — registry + `ensureNicheProfile`
      (seed → LLM → placeholder), extended with `safeCommentPatterns`,
      `commentTones`, `bannedWords` (spec §7.4). Seeds for restaurant/fitness/finance.
- [x] **Comment Studio** (`src/comment-studio/`) — 5 ranked variants (§7.1),
      pre-display scrub + simhash, plus a live final safety gate on record.
- [x] **Safety layer** (`src/safety/`) — all six mechanisms (spec §6).
- [x] **Banks** (`src/banks/`) — 3-tier hashtag bank + mixer (2+2+1, no-repeat,
      trending expiry). Comment patterns live on the niche profile.
- [x] **Caption Studio** (`src/caption-studio/`) — §7.2 prompt; hashtags from
      the mixer/bank, never the LLM.
- [x] **Agent console** (`app/console`, `src/agent-console/`) — auto-assigned
      task feed, generate → copy → mark-done (records postedAt, method=manual).
- [x] **Discord alerts** (`src/discord/`) — per-niche webhook routing.
- [x] **Admin + dashboard** (`app/admin`, `app/page.tsx`) — fleet health board,
      capability panel, stats.

## P2 — Monitoring ✅ (implemented)

- [x] `SourceAdapter` interface + circuit breaker + manual-refresh fallback.
- [x] YouTube RSS adapter — **live** (no quota, minutes-fast) + Data API
      enrichment (video description) and `@handle`/URL → channelId resolution.
- [x] Poll orchestrator: dedup by post URL, create alerts, auto-assign, ping Discord.
- [x] Adapter resolver (`monitoring/adapters/resolve.ts`): IG/TikTok use the
      **Apify** adapter when `APIFY_TOKEN` is set, else the free stub that
      honestly reports "blocked" so the breaker opens.
- [x] Apify-backed IG/TikTok adapters (`monitoring/adapters/apify.ts`),
      configurable actors via `APIFY_IG_ACTOR` / `APIFY_TIKTOK_ACTOR`.
- [x] Trend Radar multi-source scan (`trends/sources.ts`): Google Trends proxy
      (no key) + YouTube Data API search, de-duped → LLM ranking (§7.3).
- [x] Trending-hashtag tier (`banks/trending.ts`): propose → admin-approve →
      rotate → weekly expiry; enforced by the mixer.
- [x] APIs: on-demand `POST /api/monitoring/poll`, watch-target CRUD +
      `…/refresh` (manual-refresh), `POST /api/trends/scan`, hashtag approval.
- [x] Admin UIs: **Watch Targets** (add/refresh/poll, circuit status) and
      **Trend Radar** (scan, opportunities, hashtag approval).
- [ ] TikTok Creative Center source is a named stub (returns []) pending a stable
      public endpoint/actor — Google Trends + YT cover ranking in the meantime.

> Live YouTube/Google endpoints are blocked by some datacenter egress policies;
> the code degrades to structured errors + circuit breaker exactly as designed.
> Allowlist `youtube.com` / `trends.google.com` (or set `APIFY_TOKEN`) to enable
> the live success paths.

## P3 — Scheduler ✅ (implemented)

- [x] `PostAdapter` interface + per-platform adapters + BullMQ publisher pipeline.
- [x] TikTok reminder-fallback (returns `needs_human`, notifies Discord).
- [x] **YouTube upload** — `videos.insert` multipart upload via per-account OAuth
      token, fetches media bytes from the public URL (`adapters/youtube.ts`).
- [x] **Instagram Graph publish** — real container → media_publish flow for
      business accounts, image + REELS video (`adapters/instagram.ts`).
- [x] **Media library** (`scheduler/media.ts`): `MediaStore` interface, link-based
      store live; R2/S3 pluggable via `resolveUrl` (Open item #3). `media_assets`
      table + register/list APIs.
- [x] Create flow (`scheduler/create.ts`): resolve media → optional Caption
      Studio generation (bank hashtags) → persist → enqueue at `scheduledAt`.
- [x] APIs: `/api/media`, `/api/scheduled-posts` (create/list), manual
      `/api/scheduled-posts/[id]/publish`. Admin UI: **Scheduler** page.

> YT/IG publish activate when the account carries the right `authTokens`
> (`{ accessToken }` for YT; `{ igUserId, accessToken }` for IG). Without them,
> posts record as `needs_human` (reminder flow) — never silently dropped.

## P4 — Feedback ✅ (implemented)

- [x] Agent stats recompute (avg claim→posted, comments/day, totals).
- [x] **Live engagement sweep** (`analytics/metrics.ts` + `sweep.ts`): re-polls
      YT comment metrics for API-posted comments (via `platformCommentId`),
      writes `engagement_log`, and fires `engagement_zero` / `comment_missing`
      health signals. IG/YT own-post metric fetchers included.
- [x] **What-works analytics** (`analytics/whatWorks.ts`): tone/niche performance,
      top comments, best-tone-per-niche. Surfaced at **/admin/analytics**.
- [x] **Feedback loop closed**: comment generation biases toward the niche's
      best-performing tone when the caller doesn't pin one.
- [x] **YT auto-comment opt-in** per account: `dispatchAutoComment` runs the full
      safety gate, posts via Data API `commentThreads.insert` (per-account OAuth),
      records `method=api` + `platformCommentId`. Enqueued at the jittered window
      for opted-in accounts; toggled from the Analytics page.
- [x] Health tuning: sweep-driven signals feed the existing cooldown/pause logic.

## Open items (spec §13, decide during P1)

1. **App name** — decided: **Agentic** (isolated to `src/config/app.ts`).
2. **YT auto-comment pilot** — suggest 3–5 aged accounts; `ytAutoComment` flag ready.
3. **Media library storage** — R2/S3 vs Drive links — open, needed for P3.
4. **AI reply suggestions for comment threads** — v2 candidate, same prompt family.
