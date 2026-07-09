/**
 * Banned-word scrubber (spec §6.2, §8 global seed list).
 *
 * Runs on every generated variant BEFORE it reaches an agent. Combines a
 * global spam/compliance blacklist with the per-niche list. Matching is
 * case-insensitive and word-boundary-aware where the term is a single token;
 * multi-word phrases are matched as substrings.
 */

/** Global banned list seed (spec §8). */
export const GLOBAL_BANNED_WORDS: string[] = [
  // spam triggers
  "check my page",
  "check my",
  "check our",
  "check out",
  "dm me",
  "dm for",
  "follow back",
  "follow me",
  "giveaway",
  "link in bio",
  "visit my",
  "visit our",
  // financial / earnings
  "guaranteed returns",
  "guaranteed",
  "earnings",
  "get rich",
  "double your money",
  // medical
  "cure",
  "medical claim",
  "clinically proven",
];

/** Regex-detected structural spam: URLs, @mentions, emails, phone numbers. */
const STRUCTURAL_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "url", re: /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|net|org|io|co|shop|link)\b/i },
  { name: "mention", re: /(^|\s)@\w+/ },
  { name: "email", re: /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i },
  { name: "phone", re: /(\+?\d[\d\s().-]{7,}\d)/ },
];

export type ScrubResult = {
  ok: boolean;
  reason: string | null;
  matched: string[];
};

/**
 * Check a piece of text against global + niche banned lists and structural
 * spam patterns. Returns ok=false with the first blocking reason when unsafe.
 */
export function scrub(text: string, nicheBanned: string[] = []): ScrubResult {
  const lower = text.toLowerCase();
  const matched: string[] = [];

  // Combined word/phrase list (niche list already includes globals if built via
  // ensureNicheProfile, but we union again defensively).
  const list = Array.from(
    new Set([...GLOBAL_BANNED_WORDS, ...nicheBanned].map((w) => w.toLowerCase())),
  );

  for (const term of list) {
    if (!term) continue;
    if (term.includes(" ")) {
      if (lower.includes(term)) matched.push(term);
    } else {
      // single-token: word-boundary match
      const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegex(term)}([^\\p{L}\\p{N}]|$)`, "u");
      if (re.test(lower)) matched.push(term);
    }
  }

  for (const p of STRUCTURAL_PATTERNS) {
    if (p.re.test(text)) matched.push(`structural:${p.name}`);
  }

  // em-dash is explicitly forbidden in comment style (spec §7.1)
  if (text.includes("—")) matched.push("em-dash");

  return {
    ok: matched.length === 0,
    reason: matched.length ? `banned: ${matched.join(", ")}` : null,
    matched,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
