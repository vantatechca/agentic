import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { trends } from "@/db/schema";
import { notifyTrendDigest } from "@/discord/notify";

/**
 * Trend digest → Discord (spec §5, §10). Formats the day's ranked opportunities
 * for a niche into a #trends-{niche} message.
 */
export async function sendDigest(nicheKey: string, digestDate: string): Promise<number> {
  const rows = await db
    .select()
    .from(trends)
    .where(and(eq(trends.nicheKey, nicheKey), eq(trends.digestDate, digestDate)))
    .orderBy(desc(trends.score))
    .limit(8);

  if (!rows.length) return 0;

  const lines = [`📈 **Trend digest — ${nicheKey} — ${digestDate}**`, ""];
  rows.forEach((r, i) => {
    lines.push(
      `**${i + 1}. ${r.topic}** (${r.platform}, score ${r.score.toFixed(0)})`,
      r.whyNow ? `   why now: ${r.whyNow}` : "",
      r.contentAngle ? `   content: ${r.contentAngle}` : "",
      r.commentAngle ? `   comment: ${r.commentAngle}` : "",
      "",
    );
  });

  await notifyTrendDigest(nicheKey, lines.filter((l) => l !== undefined).join("\n"));
  return rows.length;
}
