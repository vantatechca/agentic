import { redirect } from "next/navigation";
import { listNiches } from "@/niches/registry";
import { capabilities } from "@/env";
import { StudioClient } from "./StudioClient";
import { getCurrentUser } from "@/auth/server";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const niches = capabilities.hasDb ? await listNiches().catch(() => []) : [];
  return (
    <>
      <h1>Studio</h1>
      <p className="subtle">Generate comments and captions with the full safety layer applied.</p>
      <StudioClient niches={niches.map((n) => ({ key: n.key, name: n.name }))} />
    </>
  );
}
