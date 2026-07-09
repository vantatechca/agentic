import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";

/**
 * Media library (spec §11 P3, Open item #3: upload to app R2/S3 vs Drive links).
 *
 * v1 is link-based: register a public media URL (works directly with IG Graph
 * publish, which requires a public image_url/video_url). A `MediaStore`
 * interface abstracts binary storage so an R2/S3 uploader can be dropped in
 * without touching callers — resolve() turns a stored asset into a public URL.
 */

export interface MediaStore {
  readonly kind: "link" | "r2" | "s3";
  /** Return a publicly-fetchable URL for the asset (required by IG Graph). */
  resolveUrl(asset: { url: string | null; storageKey: string | null }): Promise<string | null>;
}

/** Link-based store: the asset already carries a public URL. */
export const linkMediaStore: MediaStore = {
  kind: "link",
  async resolveUrl(asset) {
    return asset.url ?? null;
  },
};

/**
 * Active media store. Swap to an R2/S3 implementation here once storage is
 * provisioned (Open item #3); resolveUrl would presign the storageKey.
 */
export function getMediaStore(): MediaStore {
  return linkMediaStore;
}

export async function registerMedia(input: {
  kind: "image" | "video";
  url?: string;
  storageKey?: string;
  nicheKey?: string;
  accountId?: number;
  description?: string;
}): Promise<{ id: number }> {
  if (!input.url && !input.storageKey) {
    throw new Error("registerMedia requires a url or storageKey");
  }
  const [row] = await db
    .insert(mediaAssets)
    .values({
      kind: input.kind,
      url: input.url ?? null,
      storageKey: input.storageKey ?? null,
      nicheKey: input.nicheKey ?? null,
      accountId: input.accountId ?? null,
      description: input.description ?? null,
    })
    .returning({ id: mediaAssets.id });
  return { id: row.id };
}

export async function listMedia(limit = 100) {
  return db.select().from(mediaAssets).orderBy(desc(mediaAssets.createdAt)).limit(limit);
}

export async function getMedia(id: number) {
  const [row] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  return row ?? null;
}
