import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { getNiche, listNiches } from "@/niches/registry";
import { scanNiche } from "@/trends/scan";
import { proposeTrendingTags } from "@/banks/trending";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const Body = z.object({
  nicheKey: z.string().optional(),
  proposeHashtags: z.boolean().optional(),
});

// On-demand trend scan (spec §5). Optionally proposes hashtag candidates from
// the scanned topics for admin approval into the trending tier.
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const date = new Date().toISOString().slice(0, 10);
  const targets = parsed.data.nicheKey
    ? [await getNiche(parsed.data.nicheKey)].filter(Boolean)
    : await listNiches();

  const results: Record<string, unknown> = {};
  for (const niche of targets) {
    if (!niche) continue;
    try {
      const opps = await scanNiche(niche, date);
      results[niche.key] = { opportunities: opps.length };
      if (parsed.data.proposeHashtags && opps.length) {
        // Derive candidate hashtags from topic keywords (admin approves later).
        const tags = opps.flatMap((o) => topicToTags(o.topic)).slice(0, 10);
        const added = await proposeTrendingTags(niche.key, tags);
        results[niche.key] = { opportunities: opps.length, proposedTags: added };
      }
    } catch (e) {
      results[niche.key] = { error: (e as Error).message };
    }
  }
  return NextResponse.json({ ok: true, date, results });
}

function topicToTags(topic: string): string[] {
  return topic
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .slice(0, 2)
    .map((w) => `#${w}`);
}
