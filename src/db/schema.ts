import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Enums
// ─────────────────────────────────────────────────────────────────────────────
export const platformEnum = pgEnum("platform", ["youtube", "instagram", "tiktok"]);
export const accountStatusEnum = pgEnum("account_status", ["active", "cooldown", "paused"]);
export const alertStatusEnum = pgEnum("alert_status", ["new", "claimed", "commented", "expired"]);
export const commentMethodEnum = pgEnum("comment_method", ["api", "manual"]);
export const postStatusEnum = pgEnum("post_status", ["queued", "posted", "failed", "needs_human"]);
export const userRoleEnum = pgEnum("user_role", ["admin", "agent"]);

// ─────────────────────────────────────────────────────────────────────────────
// niches — registry: voice, terms, safe banks per niche
// ─────────────────────────────────────────────────────────────────────────────
export const niches = pgTable("niches", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(), // e.g. "restaurant", "fitness", "finance"
  name: text("name").notNull(),
  voice: text("voice").notNull().default(""),
  terms: jsonb("terms").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  safeCommentPatterns: jsonb("safe_comment_patterns")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  commentTones: jsonb("comment_tones").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  bannedWords: jsonb("banned_words").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  // hashtagBank: { evergreen: string[], trending: {tag,expiresAt}[], branded: string[] }
  hashtagBank: jsonb("hashtag_bank")
    .$type<HashtagBank>()
    .notNull()
    .default(sql`'{"evergreen":[],"trending":[],"branded":[]}'::jsonb`),
  // Full generated profile blob from ensureNicheProfile (for extensibility)
  profile: jsonb("profile").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type HashtagBank = {
  evergreen: string[];
  trending: { tag: string; expiresAt: string | null; approved: boolean }[];
  branded: string[];
};

// ─────────────────────────────────────────────────────────────────────────────
// accounts — fleet accounts across platforms
// ─────────────────────────────────────────────────────────────────────────────
export const accounts = pgTable(
  "accounts",
  {
    id: serial("id").primaryKey(),
    platform: platformEnum("platform").notNull(),
    handle: text("handle").notNull(),
    nicheKey: text("niche_key").notNull(),
    // Owning client/brand (P5). Nullable so pre-existing accounts stay valid.
    clientId: integer("client_id"),
    adsPowerProfileId: text("adspower_profile_id"),
    // Encrypted-at-rest in prod; jsonb blob of OAuth tokens (YT/IG)
    authTokens: jsonb("auth_tokens").$type<Record<string, unknown>>(),
    dailyCommentBudget: integer("daily_comment_budget").notNull().default(10),
    dailyPostBudget: integer("daily_post_budget").notNull().default(3),
    healthScore: integer("health_score").notNull().default(100),
    status: accountStatusEnum("status").notNull().default("active"),
    // Opt-in flags (P4): YT API auto-commenting per account
    ytAutoComment: boolean("yt_auto_comment").notNull().default(false),
    lastActionAt: timestamp("last_action_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    platformHandleIdx: uniqueIndex("accounts_platform_handle_idx").on(t.platform, t.handle),
    nicheIdx: index("accounts_niche_idx").on(t.nicheKey),
    statusIdx: index("accounts_status_idx").on(t.status),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// watch_targets — followed accounts we monitor for new uploads
// ─────────────────────────────────────────────────────────────────────────────
export const watchTargets = pgTable(
  "watch_targets",
  {
    id: serial("id").primaryKey(),
    platform: platformEnum("platform").notNull(),
    handle: text("handle").notNull(),
    channelId: text("channel_id"), // YT channel id for RSS
    nicheKey: text("niche_key").notNull(),
    lastSeenPostId: text("last_seen_post_id"),
    checkFrequency: integer("check_frequency_sec").notNull().default(300),
    enabled: boolean("enabled").notNull().default(true),
    // Circuit breaker state for scraper adapters (P2)
    consecutiveFailures: integer("consecutive_failures").notNull().default(0),
    circuitOpenUntil: timestamp("circuit_open_until", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    platformHandleIdx: uniqueIndex("watch_targets_platform_handle_idx").on(t.platform, t.handle),
    nicheIdx: index("watch_targets_niche_idx").on(t.nicheKey),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// alerts — new-upload alerts assigned to agents with jittered comment windows
// ─────────────────────────────────────────────────────────────────────────────
export const alerts = pgTable(
  "alerts",
  {
    id: serial("id").primaryKey(),
    watchTargetId: integer("watch_target_id").notNull(),
    platform: platformEnum("platform").notNull(),
    nicheKey: text("niche_key").notNull(),
    postUrl: text("post_url").notNull(),
    postId: text("post_id"),
    title: text("title"),
    caption: text("caption"),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    assignedAgentId: integer("assigned_agent_id"),
    assignedAccountId: integer("assigned_account_id"),
    status: alertStatusEnum("status").notNull().default("new"),
    commentWindowStart: timestamp("comment_window_start", { withTimezone: true }),
    commentWindowEnd: timestamp("comment_window_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("alerts_status_idx").on(t.status),
    agentIdx: index("alerts_agent_idx").on(t.assignedAgentId),
    nicheIdx: index("alerts_niche_idx").on(t.nicheKey),
    postUrlIdx: uniqueIndex("alerts_post_url_idx").on(t.postUrl),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// comments — generated + chosen comments, with simhash for fleet dedup
// ─────────────────────────────────────────────────────────────────────────────
export const comments = pgTable(
  "comments",
  {
    id: serial("id").primaryKey(),
    alertId: integer("alert_id"),
    accountId: integer("account_id").notNull(),
    nicheKey: text("niche_key").notNull(),
    videoUrl: text("video_url").notNull(),
    generatedVariants: jsonb("generated_variants").$type<CommentVariant[]>().notNull(),
    chosenText: text("chosen_text"),
    tone: text("tone"),
    method: commentMethodEnum("method").notNull().default("manual"),
    // Platform's own comment id (set for API-posted comments; enables metric
    // re-polling + removal detection in the engagement sweep).
    platformCommentId: text("platform_comment_id"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    // engagement snapshot: { likes, replies }
    engagement: jsonb("engagement").$type<{ likes: number; replies: number }>(),
    simHash: text("sim_hash"), // hex string of 64-bit simhash
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    accountIdx: index("comments_account_idx").on(t.accountId),
    videoIdx: index("comments_video_idx").on(t.videoUrl),
    simhashIdx: index("comments_simhash_idx").on(t.simHash),
    createdIdx: index("comments_created_idx").on(t.createdAt),
  }),
);

export type CommentVariant = {
  text: string;
  tone: string;
  lengthBand: "short" | "medium";
  riskNote: string | null;
  simHash?: string;
  blocked?: boolean;
  blockReason?: string | null;
};

// ─────────────────────────────────────────────────────────────────────────────
// captions — generated captions for own-content posts
// ─────────────────────────────────────────────────────────────────────────────
export const captions = pgTable("captions", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id"),
  nicheKey: text("niche_key").notNull(),
  platform: platformEnum("platform").notNull(),
  text: text("text").notNull(),
  altHooks: jsonb("alt_hooks").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  ytTitle: text("yt_title"),
  hashtags: jsonb("hashtags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  scheduledPostId: integer("scheduled_post_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// scheduled_posts — own-content posting queue (P3)
// ─────────────────────────────────────────────────────────────────────────────
export const scheduledPosts = pgTable(
  "scheduled_posts",
  {
    id: serial("id").primaryKey(),
    accountId: integer("account_id").notNull(),
    platform: platformEnum("platform").notNull(),
    mediaRef: text("media_ref"), // R2/S3 key or external URL
    caption: text("caption"),
    hashtags: jsonb("hashtags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: postStatusEnum("status").notNull().default("queued"),
    postedUrl: text("posted_url"),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index("scheduled_posts_status_idx").on(t.status),
    scheduledAtIdx: index("scheduled_posts_scheduled_at_idx").on(t.scheduledAt),
    accountIdx: index("scheduled_posts_account_idx").on(t.accountId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// media_assets — media library for the scheduler (P3)
// mediaRef is a public URL (link-based) or a storage key (R2/S3) — Open item #3.
// ─────────────────────────────────────────────────────────────────────────────
export const mediaKindEnum = pgEnum("media_kind", ["image", "video"]);

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: serial("id").primaryKey(),
    nicheKey: text("niche_key"),
    accountId: integer("account_id"),
    kind: mediaKindEnum("kind").notNull(),
    // Public URL (required for IG Graph publish + link-based flows) OR storage key.
    url: text("url"),
    storageKey: text("storage_key"),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    nicheIdx: index("media_assets_niche_idx").on(t.nicheKey),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// trends — per-niche trend digest opportunities (P2)
// ─────────────────────────────────────────────────────────────────────────────
export const trends = pgTable(
  "trends",
  {
    id: serial("id").primaryKey(),
    nicheKey: text("niche_key").notNull(),
    platform: platformEnum("platform").notNull(),
    topic: text("topic").notNull(),
    source: text("source").notNull(), // "yt-data-api", "google-trends", "creative-center", ...
    whyNow: text("why_now"),
    contentAngle: text("content_angle"),
    commentAngle: text("comment_angle"),
    score: real("score").notNull().default(0),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    digestDate: text("digest_date"), // YYYY-MM-DD for grouping into a daily digest
  },
  (t) => ({
    nicheIdx: index("trends_niche_idx").on(t.nicheKey),
    digestIdx: index("trends_digest_idx").on(t.digestDate),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// agents — human agents operating the fleet
// ─────────────────────────────────────────────────────────────────────────────
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  discordId: text("discord_id"),
  assignedNiches: jsonb("assigned_niches").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  active: boolean("active").notNull().default(true),
  // stats: { avgClaimTimeSec, commentsPerDay } — recomputed by analytics sweep
  stats: jsonb("stats").$type<AgentStats>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AgentStats = {
  avgClaimTimeSec?: number;
  commentsPerDay?: number;
  totalComments?: number;
  engagementEarned?: number;
};

// ─────────────────────────────────────────────────────────────────────────────
// engagement_log — time-series metrics per comment/post (P4)
// ─────────────────────────────────────────────────────────────────────────────
export const engagementLog = pgTable(
  "engagement_log",
  {
    id: serial("id").primaryKey(),
    commentId: integer("comment_id"),
    postId: integer("post_id"),
    metric: text("metric").notNull(), // "likes", "replies", "views", ...
    value: real("value").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    commentIdx: index("engagement_log_comment_idx").on(t.commentId),
    postIdx: index("engagement_log_post_idx").on(t.postId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// account_health_events — audit trail for health score changes (Safety §6.5)
// ─────────────────────────────────────────────────────────────────────────────
export const accountHealthEvents = pgTable("account_health_events", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull(),
  signal: text("signal").notNull(), // "comment_removed", "engagement_zero", "comment_missing"
  delta: integer("delta").notNull(),
  scoreAfter: integer("score_after").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────
// users — login accounts (P5). Admin manages; agents log in to their run sheet.
// ─────────────────────────────────────────────────────────────────────────────
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(), // scrypt: salt:hash (hex)
    role: userRoleEnum("role").notNull().default("agent"),
    // Agent users link to an operator profile (agents) for run sheets/stats.
    agentId: integer("agent_id"),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: uniqueIndex("users_email_idx").on(t.email),
    agentIdx: index("users_agent_idx").on(t.agentId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// clients — brands the fleet works. Each client is assigned to ONE agent and
// carries its own set of active platforms (drives the run-sheet quota cards).
// ─────────────────────────────────────────────────────────────────────────────
export const clients = pgTable(
  "clients",
  {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    nicheKey: text("niche_key"),
    assignedAgentId: integer("assigned_agent_id"),
    // Enabled platform keys from OPERATOR_PLATFORMS (tiktok, instagram, youtube,
    // facebook, reddit, gbp). Stored as text[] so it isn't bound to the core
    // platform enum (FB/Reddit/GBP are operator-managed, not fleet-automated).
    platforms: jsonb("platforms").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    peakHours: text("peak_hours"), // free text, e.g. "11:00-14:00, 18:00-21:00"
    status: text("status").notNull().default("active"), // active | paused
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    agentIdx: index("clients_agent_idx").on(t.assignedAgentId),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// run_sheets — one operator, one client, one day. Quota targets + time blocks.
// Current counts are derived from action_log (not stored here).
// ─────────────────────────────────────────────────────────────────────────────
export const runSheets = pgTable(
  "run_sheets",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    // quotas: { [platformKey]: dailyOutboundCommentTarget }
    quotas: jsonb("quotas").$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
    // blocks: [{ start, end, label, type: watch|post|admin, done }]
    blocks: jsonb("blocks").$type<RunBlock[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientDateIdx: uniqueIndex("run_sheets_client_date_idx").on(t.clientId, t.date),
  }),
);

export type RunBlock = {
  start: string; // "08:00"
  end: string; // "09:00"
  label: string;
  type: "watch" | "post" | "admin";
  done: boolean;
};

// ─────────────────────────────────────────────────────────────────────────────
// action_log — record of every logged operator action, with URLs. Drives the
// outbound comment quota meters and is the canonical post/comment URL history.
// ─────────────────────────────────────────────────────────────────────────────
export const actionLog = pgTable(
  "action_log",
  {
    id: serial("id").primaryKey(),
    clientId: integer("client_id"),
    agentId: integer("agent_id"),
    accountId: integer("account_id"),
    platform: text("platform").notNull(), // OPERATOR_PLATFORMS key
    // comment (outbound, counts to quota) | post | reply | dm | review | lead
    actionType: text("action_type").notNull(),
    targetUrl: text("target_url"), // the post/thread acted upon
    resultUrl: text("result_url"), // permalink of our comment/post
    note: text("note"),
    countsToQuota: boolean("counts_to_quota").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientIdx: index("action_log_client_idx").on(t.clientId),
    agentIdx: index("action_log_agent_idx").on(t.agentId),
    createdIdx: index("action_log_created_idx").on(t.createdAt),
    typeIdx: index("action_log_type_idx").on(t.actionType),
  }),
);

// ─────────────────────────────────────────────────────────────────────────────
// Relations
// ─────────────────────────────────────────────────────────────────────────────
export const accountsRelations = relations(accounts, ({ many }) => ({
  comments: many(comments),
  scheduledPosts: many(scheduledPosts),
}));

export const alertsRelations = relations(alerts, ({ one }) => ({
  watchTarget: one(watchTargets, {
    fields: [alerts.watchTargetId],
    references: [watchTargets.id],
  }),
  agent: one(agents, { fields: [alerts.assignedAgentId], references: [agents.id] }),
  account: one(accounts, { fields: [alerts.assignedAccountId], references: [accounts.id] }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  account: one(accounts, { fields: [comments.accountId], references: [accounts.id] }),
  alert: one(alerts, { fields: [comments.alertId], references: [alerts.id] }),
}));
