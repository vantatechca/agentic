-- ============================================================================
-- Agentic — full database schema for Neon Postgres
-- Paste this into the Neon SQL editor (or: psql "$DATABASE_URL" -f schema.sql).
-- Idempotent: safe to re-run. Mirrors src/db/schema.ts exactly.
-- After running, seed with `npm run db:seed` (optional demo data).
-- ============================================================================

-- ---- enums -----------------------------------------------------------------
DO $$ BEGIN CREATE TYPE "account_status" AS ENUM('active','cooldown','paused'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "alert_status"   AS ENUM('new','claimed','commented','expired'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "comment_method" AS ENUM('api','manual'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "media_kind"     AS ENUM('image','video'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "platform"       AS ENUM('youtube','instagram','tiktok'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "post_status"    AS ENUM('queued','posted','failed','needs_human'); EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN CREATE TYPE "user_role"      AS ENUM('admin','agent'); EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ---- tables ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "niches" (
  "id" serial PRIMARY KEY NOT NULL,
  "key" text NOT NULL,
  "name" text NOT NULL,
  "voice" text DEFAULT '' NOT NULL,
  "terms" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "safe_comment_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "comment_tones" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "banned_words" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "hashtag_bank" jsonb DEFAULT '{"evergreen":[],"trending":[],"branded":[]}'::jsonb NOT NULL,
  "profile" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "niches_key_unique" UNIQUE("key")
);

CREATE TABLE IF NOT EXISTS "accounts" (
  "id" serial PRIMARY KEY NOT NULL,
  "platform" "platform" NOT NULL,
  "handle" text NOT NULL,
  "niche_key" text NOT NULL,
  "client_id" integer,
  "adspower_profile_id" text,
  "auth_tokens" jsonb,
  "daily_comment_budget" integer DEFAULT 10 NOT NULL,
  "daily_post_budget" integer DEFAULT 3 NOT NULL,
  "health_score" integer DEFAULT 100 NOT NULL,
  "status" "account_status" DEFAULT 'active' NOT NULL,
  "yt_auto_comment" boolean DEFAULT false NOT NULL,
  "last_action_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "watch_targets" (
  "id" serial PRIMARY KEY NOT NULL,
  "platform" "platform" NOT NULL,
  "handle" text NOT NULL,
  "channel_id" text,
  "niche_key" text NOT NULL,
  "last_seen_post_id" text,
  "check_frequency_sec" integer DEFAULT 300 NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "consecutive_failures" integer DEFAULT 0 NOT NULL,
  "circuit_open_until" timestamp with time zone,
  "last_checked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "alerts" (
  "id" serial PRIMARY KEY NOT NULL,
  "watch_target_id" integer NOT NULL,
  "platform" "platform" NOT NULL,
  "niche_key" text NOT NULL,
  "post_url" text NOT NULL,
  "post_id" text,
  "title" text,
  "caption" text,
  "detected_at" timestamp with time zone DEFAULT now() NOT NULL,
  "assigned_agent_id" integer,
  "assigned_account_id" integer,
  "status" "alert_status" DEFAULT 'new' NOT NULL,
  "comment_window_start" timestamp with time zone,
  "comment_window_end" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "comments" (
  "id" serial PRIMARY KEY NOT NULL,
  "alert_id" integer,
  "account_id" integer NOT NULL,
  "niche_key" text NOT NULL,
  "video_url" text NOT NULL,
  "generated_variants" jsonb NOT NULL,
  "chosen_text" text,
  "tone" text,
  "method" "comment_method" DEFAULT 'manual' NOT NULL,
  "platform_comment_id" text,
  "posted_at" timestamp with time zone,
  "engagement" jsonb,
  "sim_hash" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "captions" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" integer,
  "niche_key" text NOT NULL,
  "platform" "platform" NOT NULL,
  "text" text NOT NULL,
  "alt_hooks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "yt_title" text,
  "hashtags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "scheduled_post_id" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "scheduled_posts" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" integer NOT NULL,
  "platform" "platform" NOT NULL,
  "media_ref" text,
  "caption" text,
  "hashtags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "scheduled_at" timestamp with time zone NOT NULL,
  "status" "post_status" DEFAULT 'queued' NOT NULL,
  "posted_url" text,
  "error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "media_assets" (
  "id" serial PRIMARY KEY NOT NULL,
  "niche_key" text,
  "account_id" integer,
  "kind" "media_kind" NOT NULL,
  "url" text,
  "storage_key" text,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "trends" (
  "id" serial PRIMARY KEY NOT NULL,
  "niche_key" text NOT NULL,
  "platform" "platform" NOT NULL,
  "topic" text NOT NULL,
  "source" text NOT NULL,
  "why_now" text,
  "content_angle" text,
  "comment_angle" text,
  "score" real DEFAULT 0 NOT NULL,
  "captured_at" timestamp with time zone DEFAULT now() NOT NULL,
  "digest_date" text
);

CREATE TABLE IF NOT EXISTS "agents" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "discord_id" text,
  "assigned_niches" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "engagement_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "comment_id" integer,
  "post_id" integer,
  "metric" text NOT NULL,
  "value" real NOT NULL,
  "captured_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "account_health_events" (
  "id" serial PRIMARY KEY NOT NULL,
  "account_id" integer NOT NULL,
  "signal" text NOT NULL,
  "delta" integer NOT NULL,
  "score_after" integer NOT NULL,
  "note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ---- indexes ---------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_platform_handle_idx" ON "accounts" USING btree ("platform","handle");
CREATE INDEX IF NOT EXISTS "accounts_niche_idx" ON "accounts" USING btree ("niche_key");
CREATE INDEX IF NOT EXISTS "accounts_status_idx" ON "accounts" USING btree ("status");
CREATE UNIQUE INDEX IF NOT EXISTS "watch_targets_platform_handle_idx" ON "watch_targets" USING btree ("platform","handle");
CREATE INDEX IF NOT EXISTS "watch_targets_niche_idx" ON "watch_targets" USING btree ("niche_key");
CREATE INDEX IF NOT EXISTS "alerts_status_idx" ON "alerts" USING btree ("status");
CREATE INDEX IF NOT EXISTS "alerts_agent_idx" ON "alerts" USING btree ("assigned_agent_id");
CREATE INDEX IF NOT EXISTS "alerts_niche_idx" ON "alerts" USING btree ("niche_key");
CREATE UNIQUE INDEX IF NOT EXISTS "alerts_post_url_idx" ON "alerts" USING btree ("post_url");
CREATE INDEX IF NOT EXISTS "comments_account_idx" ON "comments" USING btree ("account_id");
CREATE INDEX IF NOT EXISTS "comments_video_idx" ON "comments" USING btree ("video_url");
CREATE INDEX IF NOT EXISTS "comments_simhash_idx" ON "comments" USING btree ("sim_hash");
CREATE INDEX IF NOT EXISTS "comments_created_idx" ON "comments" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "scheduled_posts_status_idx" ON "scheduled_posts" USING btree ("status");
CREATE INDEX IF NOT EXISTS "scheduled_posts_scheduled_at_idx" ON "scheduled_posts" USING btree ("scheduled_at");
CREATE INDEX IF NOT EXISTS "scheduled_posts_account_idx" ON "scheduled_posts" USING btree ("account_id");
CREATE INDEX IF NOT EXISTS "media_assets_niche_idx" ON "media_assets" USING btree ("niche_key");
CREATE INDEX IF NOT EXISTS "trends_niche_idx" ON "trends" USING btree ("niche_key");
CREATE INDEX IF NOT EXISTS "trends_digest_idx" ON "trends" USING btree ("digest_date");
CREATE INDEX IF NOT EXISTS "engagement_log_comment_idx" ON "engagement_log" USING btree ("comment_id");
CREATE INDEX IF NOT EXISTS "engagement_log_post_idx" ON "engagement_log" USING btree ("post_id");

-- ---- P5: admin, clients, users, run sheets, action log ---------------------
-- For existing databases created before P5, add the accounts.client_id column:
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "client_id" integer;

CREATE TABLE IF NOT EXISTS "users" (
  "id" serial PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "name" text NOT NULL,
  "password_hash" text NOT NULL,
  "role" "user_role" DEFAULT 'agent' NOT NULL,
  "agent_id" integer,
  "active" boolean DEFAULT true NOT NULL,
  "last_login_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "clients" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "niche_key" text,
  "assigned_agent_id" integer,
  "platforms" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "peak_hours" text,
  "status" text DEFAULT 'active' NOT NULL,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "run_sheets" (
  "id" serial PRIMARY KEY NOT NULL,
  "client_id" integer NOT NULL,
  "date" text NOT NULL,
  "quotas" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "action_log" (
  "id" serial PRIMARY KEY NOT NULL,
  "client_id" integer,
  "agent_id" integer,
  "account_id" integer,
  "platform" text NOT NULL,
  "action_type" text NOT NULL,
  "target_url" text,
  "result_url" text,
  "note" text,
  "counts_to_quota" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");
CREATE INDEX IF NOT EXISTS "users_agent_idx" ON "users" USING btree ("agent_id");
CREATE INDEX IF NOT EXISTS "clients_agent_idx" ON "clients" USING btree ("assigned_agent_id");
CREATE UNIQUE INDEX IF NOT EXISTS "run_sheets_client_date_idx" ON "run_sheets" USING btree ("client_id","date");
CREATE INDEX IF NOT EXISTS "action_log_client_idx" ON "action_log" USING btree ("client_id");
CREATE INDEX IF NOT EXISTS "action_log_agent_idx" ON "action_log" USING btree ("agent_id");
CREATE INDEX IF NOT EXISTS "action_log_created_idx" ON "action_log" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "action_log_type_idx" ON "action_log" USING btree ("action_type");
