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

## P2 — Monitoring 🟡 (scaffolded)

- [x] `SourceAdapter` interface + circuit breaker + manual-refresh fallback.
- [x] YouTube RSS adapter — **live** (no quota, minutes-fast).
- [x] Poll orchestrator: dedup by post URL, create alerts, auto-assign, ping Discord.
- [x] Trend scan (§7.3) + Discord digest, wired to Inngest crons.
- [ ] IG/TikTok scrapers: currently trip the breaker (honest "blocked"). Wire an
      Apify actor in `monitoring/adapters/scrapeStub.ts` when `APIFY_TOKEN` is set.
- [ ] Trend sources beyond YT Data API: Google Trends proxy, TikTok Creative
      Center, IG hashtag pages (`trends/scan.ts` → `gatherRawSignals`).

## P3 — Scheduler 🟡 (scaffolded)

- [x] `PostAdapter` interface + per-platform adapters + BullMQ publisher pipeline.
- [x] TikTok reminder-fallback (returns `needs_human`, notifies Discord).
- [ ] YouTube `videos.insert` upload via per-account OAuth (`adapters/index.ts`).
- [ ] IG Graph media container → publish for business accounts.
- [ ] Media library: upload target (R2/S3 vs Drive links) — Open item #3.

## P4 — Feedback 🟡 (scaffolded)

- [x] Agent stats recompute (avg claim→posted, comments/day, totals).
- [x] Engagement sweep hook (writes engagement_log from stored snapshots).
- [ ] Live per-platform metric pulls in `analytics/sweep.ts` → feed
      `engagement_zero` health signal + what-works loop.
- [ ] YT auto-comment opt-in per account: `accounts.ytAutoComment` flag exists;
      wire API commenting in the comment-dispatch worker for opted-in accounts.

## Open items (spec §13, decide during P1)

1. **App name** — decided: **Agentic** (isolated to `src/config/app.ts`).
2. **YT auto-comment pilot** — suggest 3–5 aged accounts; `ytAutoComment` flag ready.
3. **Media library storage** — R2/S3 vs Drive links — open, needed for P3.
4. **AI reply suggestions for comment threads** — v2 candidate, same prompt family.
