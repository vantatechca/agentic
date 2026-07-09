DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('admin', 'agent');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "run_sheets" (
	"id" serial PRIMARY KEY NOT NULL,
	"client_id" integer NOT NULL,
	"date" text NOT NULL,
	"quotas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "client_id" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_log_client_idx" ON "action_log" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_log_agent_idx" ON "action_log" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_log_created_idx" ON "action_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "action_log_type_idx" ON "action_log" USING btree ("action_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "clients_agent_idx" ON "clients" USING btree ("assigned_agent_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "run_sheets_client_date_idx" ON "run_sheets" USING btree ("client_id","date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_agent_idx" ON "users" USING btree ("agent_id");