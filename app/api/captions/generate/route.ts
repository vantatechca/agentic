import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getNiche } from "@/niches/registry";
import { ensureNicheProfile } from "@/niches/ensureNicheProfile";
import { generateCaption } from "@/caption-studio/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  platform: z.enum(["youtube", "instagram", "tiktok"]),
  nicheKey: z.string().min(1),
  topic: z.string().min(1),
  mediaDescription: z.string().min(1),
  ctaGoal: z.string().min(1),
  verifiedFacts: z.array(z.string()).optional(),
  accountId: z.number().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;
  const niche = (await getNiche(b.nicheKey)) ?? (await ensureNicheProfile(b.nicheKey));

  try {
    const result = await generateCaption({
      platform: b.platform,
      niche,
      topic: b.topic,
      mediaDescription: b.mediaDescription,
      ctaGoal: b.ctaGoal,
      verifiedFacts: b.verifiedFacts,
      accountId: b.accountId ?? null,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
