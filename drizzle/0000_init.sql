DO $$ BEGIN
 CREATE TYPE "public"."account_status" AS ENUM('active', 'cooldown', 'paused');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."alert_status" AS ENUM('new', 'claimed', 'commented', 'expired');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."comment_method" AS ENUM('api', 'manual');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."media_kind" AS ENUM('image', 'video');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."platform" AS ENUM('youtube', 'instagram', 'tiktok');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."post_status" AS ENUM('queued', 'posted', 'failed', 'needs_human');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "account_health_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"signal" text NOT NULL,
	"delta" integer NOT NULL,
	"score_after" integer NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"platform" "platform" NOT NULL,
	"handle" text NOT NULL,
	"niche_key" text NOT NULL,
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "agents" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"discord_id" text,
	"assigned_niches" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "engagement_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"comment_id" integer,
	"post_id" integer,
	"metric" text NOT NULL,
	"value" real NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "accounts_platform_handle_idx" ON "accounts" USING btree ("platform","handle");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_niche_idx" ON "accounts" USING btree ("niche_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "accounts_status_idx" ON "accounts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alerts_status_idx" ON "alerts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alerts_agent_idx" ON "alerts" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "alerts_niche_idx" ON "alerts" USING btree ("niche_key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "alerts_post_url_idx" ON "alerts" USING btree ("post_url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_account_idx" ON "comments" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_video_idx" ON "comments" USING btree ("video_url");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_simhash_idx" ON "comments" USING btree ("sim_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "comments_created_idx" ON "comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engagement_log_comment_idx" ON "engagement_log" USING btree ("comment_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "engagement_log_post_idx" ON "engagement_log" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_assets_niche_idx" ON "media_assets" USING btree ("niche_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_posts_status_idx" ON "scheduled_posts" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_posts_scheduled_at_idx" ON "scheduled_posts" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "scheduled_posts_account_idx" ON "scheduled_posts" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trends_niche_idx" ON "trends" USING btree ("niche_key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trends_digest_idx" ON "trends" USING btree ("digest_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "watch_targets_platform_handle_idx" ON "watch_targets" USING btree ("platform","handle");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watch_targets_niche_idx" ON "watch_targets" USING btree ("niche_key");