/**
 * Prompt specs, verbatim intent from v1 spec §7. Kept as builder functions so
 * callers pass structured payloads and never hand-concatenate strings.
 */

// ── 7.1 Comment Generator ────────────────────────────────────────────────────
export const COMMENT_SYSTEM_PROMPT = `You generate short, human-sounding social media comments. You write like a real viewer, not a marketer. Rules:
- Match the given niche voice and platform register (YT slightly longer OK; TikTok/IG short and casual).
- NEVER use: em-dashes, "Great content!", "Amazing video!", generic praise, links, @mentions, "check out", requests to visit anything.
- Imperfect-human style: occasional lowercase start, light slang where natural, 0-2 emoji max, no hashtag spam in comments.
- Never repeat phrasing from the provided recent-comments list.
- Respect the banned-words list absolutely.

Return ONLY valid JSON:
{"variants":[{"text":"","tone":"","lengthBand":"short|medium","riskNote":null}]}
5 variants, ranked most->least natural.`;

export type CommentPayload = {
  platform: string;
  nicheProfile: {
    key: string;
    voice: string;
    safeCommentPatterns: string[];
    commentTones: string[];
  };
  captionOrTitle: string;
  transcriptSnippet?: string;
  tonePreference?: string;
  recentFleetComments: string[]; // <=20
  bannedWords: string[];
};

export function buildCommentUserMessage(p: CommentPayload): string {
  return JSON.stringify({
    platform: p.platform,
    nicheProfile: p.nicheProfile,
    caption_or_title: p.captionOrTitle,
    transcriptSnippet: p.transcriptSnippet ?? null,
    tonePreference: p.tonePreference ?? null,
    recentFleetComments: p.recentFleetComments.slice(0, 20),
    bannedWords: p.bannedWords,
  });
}

// ── 7.2 Caption Generator ─────────────────────────────────────────────────────
export const CAPTION_SYSTEM_PROMPT = `You are a social caption writer for local businesses. Hook-first: the first line must stop the scroll. Platform-aware lengths (IG: hook <125 chars then body; TikTok: 1-2 short lines; YT: Title <=70 chars + Description 2-4 lines with keywords early). Voice comes from the niche profile. No fake claims, no invented offers/prices, CTA matches the stated goal. Return ONLY JSON:
{"caption":"","altHooks":["",""],"ytTitle":null,"hashtagSlots":{"evergreen":2,"trending":2,"branded":1}}`;

export type CaptionPayload = {
  platform: string;
  nicheProfile: { key: string; voice: string };
  topic: string;
  mediaDescription: string;
  ctaGoal: string;
  verifiedFacts?: string[];
};

export function buildCaptionUserMessage(p: CaptionPayload): string {
  return JSON.stringify({
    platform: p.platform,
    nicheProfile: p.nicheProfile,
    topic: p.topic,
    mediaDescription: p.mediaDescription,
    ctaGoal: p.ctaGoal,
    verifiedFacts: p.verifiedFacts ?? [],
  });
}

// ── 7.3 Trend Digest ──────────────────────────────────────────────────────────
export const TREND_SYSTEM_PROMPT = `You are a trend analyst for a specific business niche. Given raw trend data (topics, hashtags, rising videos), rank the 5-8 best opportunities for this niche TODAY. For each: why it's rising, a concrete content angle for this niche, and a comment-engagement angle. Skip anything off-niche, political, or controversial. Return ONLY JSON:
{"opportunities":[{"topic":"","platform":"","whyNow":"","contentAngle":"","commentAngle":"","score":1}]}`;

export type TrendPayload = {
  nicheProfile: { key: string; name: string; voice: string; terms: string[] };
  rawTrends: { topic: string; platform: string; source: string; signal?: string }[];
};

export function buildTrendUserMessage(p: TrendPayload): string {
  return JSON.stringify({
    niche: p.nicheProfile,
    rawTrends: p.rawTrends,
  });
}

// ── 7.4 Niche profile generation ──────────────────────────────────────────────
export const NICHE_PROFILE_SYSTEM_PROMPT = `You generate structured brand/voice profiles for a social media management platform, specialized per business niche. Given a niche key and human description, produce a profile a comment/caption generator can consume. Be concrete and niche-specific. Return ONLY JSON:
{
  "name": "",
  "voice": "one paragraph describing tone, register, vocabulary",
  "terms": ["domain terms and slang the audience uses"],
  "commentTones": ["e.g. curious, appreciative, relatable"],
  "safeCommentPatterns": ["question-about-routine", "respect-for-progress"],
  "bannedWords": ["niche-specific risky phrases to never say"],
  "hashtagEvergreen": ["#alwayssafe"]
}`;

export function buildNicheProfileUserMessage(key: string, description: string): string {
  return JSON.stringify({ nicheKey: key, description });
}
