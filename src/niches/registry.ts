import { eq } from "drizzle-orm";
import { db } from "@/db";
import { niches } from "@/db/schema";
import type { HashtagBank } from "@/db/schema";

export type NicheProfile = {
  key: string;
  name: string;
  voice: string;
  terms: string[];
  commentTones: string[];
  safeCommentPatterns: string[];
  bannedWords: string[];
  hashtagBank: HashtagBank;
};

/** Fetch a niche profile from the DB, or null if not yet created. */
export async function getNiche(key: string): Promise<NicheProfile | null> {
  const rows = await db.select().from(niches).where(eq(niches.key, key)).limit(1);
  const row = rows[0];
  if (!row) return null;
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

export async function listNiches(): Promise<NicheProfile[]> {
  const rows = await db.select().from(niches);
  return rows.map((row) => ({
    key: row.key,
    name: row.name,
    voice: row.voice,
    terms: row.terms,
    commentTones: row.commentTones,
    safeCommentPatterns: row.safeCommentPatterns,
    bannedWords: row.bannedWords,
    hashtagBank: row.hashtagBank,
  }));
}
