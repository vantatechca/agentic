import { generateJson } from "@/ai/provider";
import { CAPTION_SYSTEM_PROMPT, buildCaptionUserMessage } from "@/ai/prompts";
import type { NicheProfile } from "@/niches/registry";
import { mixHashtags, DEFAULT_SLOTS, type MixSlots } from "@/banks/hashtagMixer";
import { scrub } from "@/safety/bannedWords";

/**
 * Caption Studio (spec §4 Module, §7.2 prompt).
 *
 * The LLM writes the caption + alt hooks + optional YT title and REQUESTS
 * hashtag slot counts — but the actual tags come from the mixer/bank, never the
 * model (prevents invented/banned tags). Caption text is scrubbed too.
 */

export type CaptionResult = {
  caption: string;
  altHooks: string[];
  ytTitle: string | null;
  hashtags: string[];
  captionScrub: { ok: boolean; reason: string | null };
};

type LLMCaption = {
  caption: string;
  altHooks: string[];
  ytTitle: string | null;
  hashtagSlots?: MixSlots;
};

export async function generateCaption(args: {
  platform: string;
  niche: NicheProfile;
  topic: string;
  mediaDescription: string;
  ctaGoal: string;
  verifiedFacts?: string[];
  accountId?: number | null;
}): Promise<CaptionResult> {
  const out = await generateJson<LLMCaption>(
    [
      { role: "system", content: CAPTION_SYSTEM_PROMPT },
      {
        role: "user",
        content: buildCaptionUserMessage({
          platform: args.platform,
          nicheProfile: { key: args.niche.key, voice: args.niche.voice },
          topic: args.topic,
          mediaDescription: args.mediaDescription,
          ctaGoal: args.ctaGoal,
          verifiedFacts: args.verifiedFacts,
        }),
      },
    ],
    { temperature: 0.8, maxTokens: 900 },
  );

  const slots = normalizeSlots(out.hashtagSlots);
  const hashtags = await mixHashtags({
    bank: args.niche.hashtagBank,
    accountId: args.accountId ?? null,
    slots,
  });

  const caption = (out.caption ?? "").trim();
  const captionScrub = scrub(caption, args.niche.bannedWords);

  return {
    caption,
    altHooks: Array.isArray(out.altHooks) ? out.altHooks.slice(0, 3) : [],
    ytTitle: args.platform === "youtube" ? out.ytTitle ?? null : null,
    hashtags,
    captionScrub: { ok: captionScrub.ok, reason: captionScrub.reason },
  };
}

function normalizeSlots(s?: MixSlots): MixSlots {
  if (!s) return DEFAULT_SLOTS;
  const clamp = (n: unknown, d: number) =>
    typeof n === "number" && n >= 0 && n <= 5 ? Math.floor(n) : d;
  return {
    evergreen: clamp(s.evergreen, DEFAULT_SLOTS.evergreen),
    trending: clamp(s.trending, DEFAULT_SLOTS.trending),
    branded: clamp(s.branded, DEFAULT_SLOTS.branded),
  };
}
