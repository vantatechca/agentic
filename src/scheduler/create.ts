import { eq } from "drizzle-orm";
import { db } from "@/db";
import { scheduledPosts, accounts, captions } from "@/db/schema";
import { getNiche } from "@/niches/registry";
import { ensureNicheProfile } from "@/niches/ensureNicheProfile";
import { generateCaption } from "@/caption-studio/generate";
import { getMedia, getMediaStore } from "./media";
import { enqueuePostPublish } from "@/queue/queues";

/**
 * Create a scheduled own-content post (spec §6 Scheduler). Resolves a media
 * asset to a public URL, optionally generates the caption via Caption Studio
 * (hashtags from the bank), persists the post, and enqueues the BullMQ publish
 * job at scheduledAt. TikTok posts still enqueue — the adapter returns
 * needs_human (reminder), which the publisher records.
 */
export async function createScheduledPost(args: {
  accountId: number;
  scheduledAt: Date;
  mediaId?: number;
  mediaUrl?: string;
  caption?: string;
  // If caption not provided, generate one from these:
  generate?: { topic: string; mediaDescription: string; ctaGoal: string; verifiedFacts?: string[] };
}): Promise<{ id: number; caption: string | null; hashtags: string[] }> {
  const [acct] = await db.select().from(accounts).where(eq(accounts.id, args.accountId)).limit(1);
  if (!acct) throw new Error(`account ${args.accountId} not found`);

  // Resolve media → public URL
  let mediaRef: string | null = args.mediaUrl ?? null;
  if (!mediaRef && args.mediaId) {
    const asset = await getMedia(args.mediaId);
    if (!asset) throw new Error(`media ${args.mediaId} not found`);
    mediaRef = await getMediaStore().resolveUrl(asset);
  }

  // Caption + hashtags
  let caption = args.caption ?? null;
  let hashtags: string[] = [];
  if (!caption && args.generate) {
    const niche = (await getNiche(acct.nicheKey)) ?? (await ensureNicheProfile(acct.nicheKey));
    const gen = await generateCaption({
      platform: acct.platform,
      niche,
      topic: args.generate.topic,
      mediaDescription: args.generate.mediaDescription,
      ctaGoal: args.generate.ctaGoal,
      verifiedFacts: args.generate.verifiedFacts,
      accountId: acct.id,
    });
    caption = gen.caption;
    hashtags = gen.hashtags;
    // Persist the generated caption for the record/analytics loop.
    await db.insert(captions).values({
      accountId: acct.id,
      nicheKey: acct.nicheKey,
      platform: acct.platform,
      text: gen.caption,
      altHooks: gen.altHooks,
      ytTitle: gen.ytTitle,
      hashtags: gen.hashtags,
    });
  }

  const [post] = await db
    .insert(scheduledPosts)
    .values({
      accountId: acct.id,
      platform: acct.platform,
      mediaRef,
      caption,
      hashtags,
      scheduledAt: args.scheduledAt,
      status: "queued",
    })
    .returning({ id: scheduledPosts.id });

  await enqueuePostPublish(post.id, args.scheduledAt);

  return { id: post.id, caption, hashtags };
}
