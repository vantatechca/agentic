import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getNiche } from "@/niches/registry";
import { ensureNicheProfile } from "@/niches/ensureNicheProfile";
import { generateComments } from "@/comment-studio/generate";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  platform: z.enum(["youtube", "instagram", "tiktok"]),
  nicheKey: z.string().min(1),
  videoUrl: z.string().url(),
  captionOrTitle: z.string().min(1),
  transcriptSnippet: z.string().optional(),
  tonePreference: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const b = parsed.data;

  const niche = (await getNiche(b.nicheKey)) ?? (await ensureNicheProfile(b.nicheKey));

  try {
    const result = await generateComments({
      platform: b.platform,
      niche,
      videoUrl: b.videoUrl,
      captionOrTitle: b.captionOrTitle,
      transcriptSnippet: b.transcriptSnippet,
      tonePreference: b.tonePreference,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
