import { NextRequest, NextResponse } from "next/server";
import { getOrCreateRunSheet } from "@/run/service";
import { todayStr } from "@/config/operators";

export const dynamic = "force-dynamic";

// Get (materializing if needed) a client's run sheet for a date.
// Any authenticated user may read (middleware enforces auth); the operator UI
// only requests sheets for the client they're assigned to.
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clientId = Number(searchParams.get("clientId"));
  const date = searchParams.get("date") || todayStr();
  if (!Number.isFinite(clientId)) return NextResponse.json({ error: "clientId required" }, { status: 400 });

  const sheet = await getOrCreateRunSheet(clientId, date);
  if (!sheet) return NextResponse.json({ error: "client not found" }, { status: 404 });
  return NextResponse.json({ sheet });
}
