import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/adminAuth";
import { registerMedia, listMedia } from "@/scheduler/media";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await listMedia();
  return NextResponse.json({ media: rows });
}

const Body = z.object({
  kind: z.enum(["image", "video"]),
  url: z.string().url().optional(),
  storageKey: z.string().optional(),
  nicheKey: z.string().optional(),
  accountId: z.number().optional(),
  description: z.string().optional(),
});

// Register a media asset (link-based v1; R2/S3 storageKey supported by schema).
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (!parsed.data.url && !parsed.data.storageKey) {
    return NextResponse.json({ error: "url or storageKey required" }, { status: 400 });
  }
  try {
    const { id } = await registerMedia(parsed.data);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
