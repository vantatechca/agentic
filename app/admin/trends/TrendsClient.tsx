"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Trend = {
  id: number;
  nicheKey: string;
  platform: string;
  topic: string;
  whyNow: string | null;
  contentAngle: string | null;
  commentAngle: string | null;
  score: number;
  source: string;
};
type TrendingTag = { tag: string; expiresAt: string | null; approved: boolean };
type Niche = { key: string; name: string; trending: TrendingTag[] };

export function TrendsClient({
  trends,
  niches,
  aiOn,
}: {
  trends: Trend[];
  niches: Niche[];
  aiOn: boolean;
}) {
  const router = useRouter();
  const [token, setToken] = useState<string>(
    typeof window !== "undefined" ? localStorage.getItem("adminToken") || "" : "",
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const headers = { "Content-Type": "application/json", "x-admin-token": token };

  function saveToken(t: string) {
    setToken(t);
    if (typeof window !== "undefined") localStorage.setItem("adminToken", t);
  }

  async function scan() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/trends/scan", {
      method: "POST",
      headers,
      body: JSON.stringify({ proposeHashtags: true }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Scan: ${JSON.stringify(data.results)}` : `Error: ${data.error?.message || data.error}`);
    setBusy(false);
    router.refresh();
  }

  async function approve(nicheKey: string, tag: string, action: "approve" | "reject") {
    setBusy(true);
    const res = await fetch("/api/trends/hashtags", {
      method: "POST",
      headers,
      body: JSON.stringify({ nicheKey, tag, action }),
    });
    const data = await res.json();
    setMsg(res.ok ? `${action}d ${tag}` : `Error: ${data.error}`);
    setBusy(false);
    router.refresh();
  }

  const byNiche = new Map<string, Trend[]>();
  for (const t of trends) {
    if (!byNiche.has(t.nicheKey)) byNiche.set(t.nicheKey, []);
    byNiche.get(t.nicheKey)!.push(t);
  }

  return (
    <>
      <div className="card" style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "end", flexWrap: "wrap" }}>
        <label style={{ flex: 1, minWidth: 240 }}>
          <div className="subtle" style={{ fontSize: 12 }}>Admin token</div>
          <input type="password" value={token} onChange={(e) => saveToken(e.target.value)} placeholder="ADMIN_API_TOKEN" />
        </label>
        <button onClick={scan} disabled={busy}>Scan trends now</button>
      </div>
      {!aiOn && (
        <div className="subtle" style={{ marginTop: 8, fontSize: 12 }}>
          No AI provider configured — scans gather raw signals but can’t rank opportunities.
        </div>
      )}
      {msg && <div className="subtle mono" style={{ marginTop: 8, fontSize: 12 }}>{msg}</div>}

      <h2>Proposed trending hashtags</h2>
      <div className="grid cols-3">
        {niches.map((n) => (
          <div key={n.key} className="card">
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{n.name}</div>
            {n.trending.length === 0 ? (
              <div className="subtle" style={{ fontSize: 12 }}>No trending tags.</div>
            ) : (
              n.trending.map((t) => (
                <div key={t.tag} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span className="mono" style={{ fontSize: 12 }}>
                    {t.tag} {t.approved ? <span className="badge active">approved</span> : <span className="badge new">pending</span>}
                  </span>
                  <span style={{ display: "flex", gap: 4 }}>
                    {!t.approved && (
                      <button className="ghost" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => approve(n.key, t.tag, "approve")} disabled={busy}>✓</button>
                    )}
                    <button className="ghost" style={{ padding: "2px 8px", fontSize: 11 }} onClick={() => approve(n.key, t.tag, "reject")} disabled={busy}>✕</button>
                  </span>
                </div>
              ))
            )}
          </div>
        ))}
      </div>

      <h2>Recent opportunities</h2>
      {trends.length === 0 ? (
        <div className="empty">No trends captured yet. Run a scan.</div>
      ) : (
        [...byNiche.entries()].map(([niche, list]) => (
          <div key={niche} style={{ marginBottom: 16 }}>
            <div className="subtle" style={{ textTransform: "uppercase", fontSize: 11, margin: "8px 0" }}>{niche}</div>
            {list.slice(0, 8).map((t) => (
              <div key={t.id} className="variant">
                <div style={{ fontWeight: 600 }}>
                  {t.topic} <span className="phase-pill">{t.platform}</span> <span className="phase-pill">score {t.score.toFixed(0)}</span>
                </div>
                {t.whyNow && <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>why: {t.whyNow}</div>}
                {t.contentAngle && <div className="subtle" style={{ fontSize: 12 }}>content: {t.contentAngle}</div>}
                {t.commentAngle && <div className="subtle" style={{ fontSize: 12 }}>comment: {t.commentAngle}</div>}
              </div>
            ))}
          </div>
        ))
      )}
    </>
  );
}
