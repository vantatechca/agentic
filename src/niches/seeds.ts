import type { HashtagBank } from "@/db/schema";

/**
 * Seed niche profiles. These make the platform useful on day one without an AI
 * call, and act as fallbacks if `ensureNicheProfile` can't reach a provider.
 * New niches are generated on demand via the LLM (see ensureNicheProfile.ts).
 */
export type SeedNiche = {
  key: string;
  name: string;
  voice: string;
  terms: string[];
  commentTones: string[];
  safeCommentPatterns: string[];
  bannedWords: string[];
  hashtagBank: HashtagBank;
};

export const SEED_NICHES: SeedNiche[] = [
  {
    key: "restaurant",
    name: "Restaurant / Food",
    voice:
      "Warm, hungry-sounding local food lover. Casual, sensory language about taste, texture and cravings. Speaks like a regular customer, not a critic.",
    terms: ["foodie", "craving", "flavour", "menu", "brunch", "special", "dish"],
    commentTones: ["crave-reaction", "curious", "appreciative"],
    safeCommentPatterns: ["crave-reaction", "need-to-try-this", "location-question"],
    bannedWords: ["guaranteed", "best in the world", "free food", "DM me"],
    hashtagBank: {
      evergreen: ["#foodie", "#mtlfood", "#foodstagram", "#eeeeeats", "#localeats"],
      trending: [],
      branded: [],
    },
  },
  {
    key: "fitness",
    name: "Fitness / Gym",
    voice:
      "Encouraging gym-goer who respects the grind. Motivational but not preachy, uses light gym slang, celebrates progress and effort.",
    terms: ["gains", "PR", "reps", "form", "cut", "bulk", "routine", "recovery"],
    commentTones: ["respect-for-progress", "curious", "relatable-struggle"],
    safeCommentPatterns: ["question-about-routine", "respect-for-progress", "relatable-struggle"],
    bannedWords: [
      "cure",
      "guaranteed results",
      "lose X pounds",
      "medical",
      "prescription",
      "steroids",
    ],
    hashtagBank: {
      evergreen: ["#gymlife", "#fitnessmotivation", "#fitfam", "#trainhard", "#gymmotivation"],
      trending: [],
      branded: [],
    },
  },
  {
    key: "finance",
    name: "Finance / Loans",
    voice:
      "Clear, calm, appreciative of good explanations. Never gives advice or makes claims. Asks clarifying follow-up questions like a curious learner.",
    terms: ["budget", "rate", "credit", "savings", "planning", "clarity"],
    commentTones: ["appreciation-for-clarity", "curious"],
    safeCommentPatterns: ["appreciation-for-clarity", "follow-up-question"],
    // Compliance-critical: hard bans enforced by the scrubber before display.
    bannedWords: [
      "guaranteed returns",
      "guaranteed",
      "risk-free",
      "you should",
      "you will make",
      "double your money",
      "get rich",
      "financial advice",
      "invest now",
      "no risk",
    ],
    hashtagBank: {
      evergreen: ["#personalfinance", "#moneytips", "#financialliteracy", "#budgeting"],
      trending: [],
      branded: [],
    },
  },
];

export const SEED_NICHE_MAP = Object.fromEntries(SEED_NICHES.map((n) => [n.key, n]));
