import { eq } from "drizzle-orm";
import { db } from "@/db";
import { niches } from "@/db/schema";
import type { HashtagBank } from "@/db/schema";
import { generateJson } from "@/ai/provider";
import {
  NICHE_PROFILE_SYSTEM_PROMPT,
  buildNicheProfileUserMessage,
} from "@/ai/prompts";
import { SEED_NICHE_MAP } from "./seeds";
import { GLOBAL_BANNED_WORDS } from "@/safety/bannedWords";
import type { NicheProfile } from "./registry";

/**
 * Idempotently ensure a niche profile exists (spec §7.4 — reuse the
 * ensureNicheProfile pattern, extended with SMM fields).
 *
 * Order of resolution:
 *   1. Already in DB → return it.
 *   2. Have a seed for this key → insert the seed.
 *   3. Otherwise → LLM-generate a profile from the description, insert it.
 *      If the LLM is unavailable, insert a minimal placeholder so the fleet
 *      never blocks on profile generation.
 */
export async function ensureNicheProfile(
  key: string,
  description?: string,
): Promise<NicheProfile> {
  const existing = await db.select().from(niches).where(eq(niches.key, key)).limit(1);
  if (existing[0]) return toProfile(existing[0]);

  // Seed path
  const seed = SEED_NICHE_MAP[key];
  if (seed) {
    const [inserted] = await db
      .insert(niches)
      .values({
        key: seed.key,
        name: seed.name,
        voice: seed.voice,
        terms: seed.terms,
        commentTones: seed.commentTones,
        safeCommentPatterns: seed.safeCommentPatterns,
        bannedWords: dedupeBanned(seed.bannedWords),
        hashtagBank: seed.hashtagBank,
      })
      .onConflictDoNothing({ target: niches.key })
      .returning();
    if (inserted) return toProfile(inserted);
    // Race: someone inserted between our select and insert — read it back.
    const reread = await db.select().from(niches).where(eq(niches.key, key)).limit(1);
    if (reread[0]) return toProfile(reread[0]);
  }

  // LLM generation path
  let generated: GeneratedProfile | null = null;
  try {
    generated = await generateJson<GeneratedProfile>(
      [
        { role: "system", content: NICHE_PROFILE_SYSTEM_PROMPT },
        {
          role: "user",
          content: buildNicheProfileUserMessage(key, description ?? key),
        },
      ],
      { temperature: 0.6, maxTokens: 1200 },
    );
  } catch (e) {
    console.warn(`[niche] LLM generation failed for "${key}", using placeholder:`, (e as Error).message);
  }

  const hashtagBank: HashtagBank = {
    evergreen: generated?.hashtagEvergreen ?? [],
    trending: [],
    branded: [],
  };

  const [inserted] = await db
    .insert(niches)
    .values({
      key,
      name: generated?.name ?? titleCase(key),
      voice: generated?.voice ?? `${titleCase(key)} audience voice.`,
      terms: generated?.terms ?? [],
      commentTones: generated?.commentTones ?? ["curious", "appreciative"],
      safeCommentPatterns: generated?.safeCommentPatterns ?? [],
      bannedWords: dedupeBanned(generated?.bannedWords ?? []),
      hashtagBank,
      profile: generated ? (generated as unknown as Record<string, unknown>) : undefined,
    })
    .onConflictDoNothing({ target: niches.key })
    .returning();

  if (inserted) return toProfile(inserted);
  const reread = await db.select().from(niches).where(eq(niches.key, key)).limit(1);
  return toProfile(reread[0]!);
}

type GeneratedProfile = {
  name: string;
  voice: string;
  terms: string[];
  commentTones: string[];
  safeCommentPatterns: string[];
  bannedWords: string[];
  hashtagEvergreen: string[];
};

/** Merge niche-specific bans with the global list so callers get the full set. */
function dedupeBanned(nicheBanned: string[]): string[] {
  return Array.from(new Set([...GLOBAL_BANNED_WORDS, ...nicheBanned].map((w) => w.toLowerCase())));
}

function titleCase(s: string): string {
  return s.replace(/(^|[-_\s])(\w)/g, (_, sep, c) => (sep ? " " : "") + c.toUpperCase());
}

function toProfile(row: typeof niches.$inferSelect): NicheProfile {
  return {
    key: row.key,
    name: row.name,
    voice: row.voice,
    terms: row.terms,
    commentTones: row.commentTones,
    safeCommentPatterns: row.safeCommentPatterns,
    bannedWords: row.bannedWords,
    hashtagBank: row.hashtagBank,
  };
}
