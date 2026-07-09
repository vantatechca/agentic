import { db } from "./index";
import { niches, agents, accounts, watchTargets } from "./schema";
import { SEED_NICHES } from "@/niches/seeds";
import { GLOBAL_BANNED_WORDS } from "@/safety/bannedWords";
import { randomDailyCommentBudget } from "@/safety/jitter";

/**
 * Seed the fleet with the built-in niches, a couple of demo agents/accounts,
 * and one YouTube watch target so the console has something to show.
 * Idempotent: uses onConflictDoNothing on natural keys.
 */
async function main() {
  console.log("Seeding niches…");
  for (const n of SEED_NICHES) {
    await db
      .insert(niches)
      .values({
        key: n.key,
        name: n.name,
        voice: n.voice,
        terms: n.terms,
        commentTones: n.commentTones,
        safeCommentPatterns: n.safeCommentPatterns,
        bannedWords: Array.from(new Set([...GLOBAL_BANNED_WORDS, ...n.bannedWords])),
        hashtagBank: n.hashtagBank,
      })
      .onConflictDoNothing({ target: niches.key });
  }

  console.log("Seeding agents…");
  await db
    .insert(agents)
    .values([
      { name: "Agent Ada", discordId: null, assignedNiches: ["restaurant", "fitness"] },
      { name: "Agent Beck", discordId: null, assignedNiches: ["finance", "restaurant"] },
    ])
    .onConflictDoNothing();

  console.log("Seeding accounts…");
  await db
    .insert(accounts)
    .values([
      {
        platform: "youtube",
        handle: "demo_resto_yt",
        nicheKey: "restaurant",
        adsPowerProfileId: "ap-001",
        dailyCommentBudget: randomDailyCommentBudget(),
      },
      {
        platform: "instagram",
        handle: "demo_fit_ig",
        nicheKey: "fitness",
        adsPowerProfileId: "ap-002",
        dailyCommentBudget: randomDailyCommentBudget(),
      },
    ])
    .onConflictDoNothing({ target: [accounts.platform, accounts.handle] });

  console.log("Seeding watch targets…");
  await db
    .insert(watchTargets)
    .values([
      {
        platform: "youtube",
        handle: "YouTube Creators",
        // Public channel id for the "YouTube Creators" channel (example).
        channelId: "UCkRfArvrzheW2E7b6SVT7vQ",
        nicheKey: "restaurant",
      },
    ])
    .onConflictDoNothing({ target: [watchTargets.platform, watchTargets.handle] });

  console.log("✅ Seed complete.");
}

main().catch((e) => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
