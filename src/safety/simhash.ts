import { createHash } from "node:crypto";

/**
 * 64-bit SimHash for near-duplicate detection across the fleet (spec §6.1).
 *
 * Same concept as the style-profile Hamming reroll: every generated comment
 * gets a simhash; we block a variant if its Hamming distance to an existing
 * fleet comment is small (i.e. similarity above threshold).
 *
 * Implementation notes:
 * - Token shingles (word-level 2-grams + unigrams) capture phrasing overlap.
 * - Each shingle hashed to 64 bits via md5 (deterministic, no crypto need).
 * - Bit vote across shingles → 64-bit fingerprint, returned as 16-hex chars.
 */

const BITS = 64;

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function shingles(tokens: string[]): string[] {
  const grams: string[] = [...tokens];
  for (let i = 0; i < tokens.length - 1; i++) {
    grams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return grams.length ? grams : ["∅"];
}

/** Hash a shingle to a 64-bit BigInt. */
function hash64(s: string): bigint {
  const digest = createHash("md5").update(s).digest();
  // Use the first 8 bytes as a 64-bit unsigned integer.
  let v = 0n;
  for (let i = 0; i < 8; i++) {
    v = (v << 8n) | BigInt(digest[i]);
  }
  return v;
}

/** Compute the SimHash of a text, returned as a 16-char hex string. */
export function simhash(text: string): string {
  const grams = shingles(tokenize(text));
  const votes = new Array<number>(BITS).fill(0);
  for (const g of grams) {
    const h = hash64(g);
    for (let b = 0; b < BITS; b++) {
      const bit = (h >> BigInt(b)) & 1n;
      votes[b] += bit === 1n ? 1 : -1;
    }
  }
  let fingerprint = 0n;
  for (let b = 0; b < BITS; b++) {
    if (votes[b] > 0) fingerprint |= 1n << BigInt(b);
  }
  return fingerprint.toString(16).padStart(16, "0");
}

/** Hamming distance between two 16-hex simhashes (0 = identical, 64 = opposite). */
export function hammingDistance(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let dist = 0;
  while (x > 0n) {
    dist += Number(x & 1n);
    x >>= 1n;
  }
  return dist;
}

/**
 * Similarity as fraction of matching bits (1.0 = identical).
 * Threshold-based blocking uses this: block if similarity > threshold.
 */
export function similarity(a: string, b: string): number {
  return (BITS - hammingDistance(a, b)) / BITS;
}

/** Default similarity threshold above which a comment is considered a near-dup. */
export const SIMILARITY_THRESHOLD = 0.82;
