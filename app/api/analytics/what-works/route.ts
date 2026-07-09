import { NextResponse } from "next/server";
import { tonePerformance, nichePerformance, topComments, bestToneByNiche } from "@/analytics/whatWorks";

export const dynamic = "force-dynamic";

// What-works aggregates (spec §9). Read-only; safe to expose without admin gate.
export async function GET() {
  const [tones, niches, top, bestTone] = await Promise.all([
    tonePerformance(),
    nichePerformance(),
    topComments(10),
    bestToneByNiche(),
  ]);
  return NextResponse.json({ tones, niches, topComments: top, bestToneByNiche: bestTone });
}
