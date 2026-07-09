import { listNiches } from "@/niches/registry";
import { capabilities } from "@/env";
import { StudioClient } from "./StudioClient";

export const dynamic = "force-dynamic";

export default async function StudioPage() {
  const niches = capabilities.hasDb ? await listNiches().catch(() => []) : [];
  return (
    <>
      <h1>Studio</h1>
      <p className="subtle">Generate comments and captions with the full safety layer applied.</p>
      <StudioClient niches={niches.map((n) => ({ key: n.key, name: n.name }))} />
    </>
  );
}
