import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { trends } from "@/db/schema";

export const dynamic = "force-dynamic";

// List recent trend opportunities, optionally filtered by niche + digest date.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nicheKey = searchParams.get("niche");
  const digestDate = searchParams.get("date");

  const conditions = [];
  if (nicheKey) conditions.push(eq(trends.nicheKey, nicheKey));
  if (digestDate) conditions.push(eq(trends.digestDate, digestDate));

  const rows = await db
    .select()
    .from(trends)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(trends.capturedAt))
    .limit(100);

  return NextResponse.json({ trends: rows });
}
