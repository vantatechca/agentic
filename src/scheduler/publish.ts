import { eq } from "drizzle-orm";
import { db } from "@/db";
import { scheduledPosts, accounts } from "@/db/schema";
import { getPostAdapter } from "./adapters";
import { markActionTaken } from "@/safety/budgets";
import { notifyFleetHealth } from "@/discord/notify";

/**
 * Publish one scheduled post (called by the pg-boss post-publisher worker).
 * Enforces account status + delegates to the platform adapter. Records the
 * outcome back onto the row. Reminder-mode / missing-credential outcomes land
 * as `needs_human` so an agent can post manually.
 */
export async function publishScheduledPost(scheduledPostId: number): Promise<{ status: string }> {
  const [post] = await db
    .select()
    .from(scheduledPosts)
    .where(eq(scheduledPosts.id, scheduledPostId))
    .limit(1);
  if (!post) return { status: "not_found" };
  if (post.status !== "queued") return { status: post.status };

  const [acct] = await db.select().from(accounts).where(eq(accounts.id, post.accountId)).limit(1);
  if (!acct || acct.status === "paused") {
    await db
      .update(scheduledPosts)
      .set({ status: "needs_human", error: "account paused/missing" })
      .where(eq(scheduledPosts.id, scheduledPostId));
    return { status: "needs_human" };
  }

  const adapter = getPostAdapter(post.platform);
  const outcome = await adapter.publish({
    accountId: post.accountId,
    platform: post.platform,
    mediaRef: post.mediaRef,
    caption: post.caption,
    hashtags: post.hashtags,
    authTokens: acct.authTokens,
  });

  if (outcome.status === "posted") {
    await db
      .update(scheduledPosts)
      .set({ status: "posted", postedUrl: outcome.url, error: null })
      .where(eq(scheduledPosts.id, scheduledPostId));
    await markActionTaken(post.accountId);
  } else if (outcome.status === "needs_human") {
    await db
      .update(scheduledPosts)
      .set({ status: "needs_human", error: outcome.reason })
      .where(eq(scheduledPosts.id, scheduledPostId));
    await notifyFleetHealth(
      `📌 Post for **${acct.handle}** (${post.platform}) needs a human: ${outcome.reason}`,
    ).catch(() => {});
  } else {
    await db
      .update(scheduledPosts)
      .set({ status: "failed", error: outcome.error })
      .where(eq(scheduledPosts.id, scheduledPostId));
  }

  return { status: outcome.status };
}
