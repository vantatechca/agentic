import { NextRequest, NextResponse } from "next/server";
import { tonePerformance, nichePerformance, topComments, bestToneByNiche } from "@/analytics/whatWorks";
import { requireUserRoute } from "@/auth/server";

export const dynamic = "force-dynamic";

// What-works aggregates (spec §9). Any authenticated user may read.
export async function GET(req: NextRequest) {
  const auth = await requireUserRoute(req);
  if ("response" in auth) return auth.response;

  const [tones, niches, top, bestTone] = await Promise.all([
    tonePerformance(),
    nichePerformance(),
    topComments(10),
    bestToneByNiche(),
  ]);
  return NextResponse.json({ tones, niches, topComments: top, bestToneByNiche: bestTone });
}
