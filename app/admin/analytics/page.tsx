import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, agents } from "@/db/schema";
import { capabilities } from "@/env";
import { tonePerformance, nichePerformance, topComments } from "@/analytics/whatWorks";
import { OptInToggles } from "./OptInToggles";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  if (!capabilities.hasDb) {
    return (
      <>
        <h1>Analytics</h1>
        <div className="empty">Database not configured.</div>
      </>
    );
  }

  const [tones, niches, top, agentRows, ytAccounts] = await Promise.all([
    tonePerformance().catch(() => []),
    nichePerformance().catch(() => []),
    topComments(10).catch(() => []),
    db.select().from(agents),
    db.select().from(accounts).where(eq(accounts.platform, "youtube")).limit(100),
  ]);

  return (
    <>
      <h1>Analytics — What Works</h1>
      <p className="subtle">Engagement feedback loop: tones, niches, top comments, agent stats.</p>

      <div className="grid cols-3" style={{ marginTop: 16 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Tone performance</h2>
          {tones.length === 0 ? <div className="subtle">No data yet.</div> : tones.map((t) => (
            <Row key={t.tone} label={t.tone} value={`${t.avgEngagement} avg · ${t.count}`} />
          ))}
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Niche performance</h2>
          {niches.length === 0 ? <div className="subtle">No data yet.</div> : niches.map((n) => (
            <Row key={n.nicheKey} label={n.nicheKey} value={`${n.avgEngagement} avg · ${n.count}`} />
          ))}
        </div>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Agents</h2>
          {agentRows.map((a) => (
            <Row
              key={a.id}
              label={a.name}
              value={`${a.stats.commentsPerDay ?? 0}/day · ${Math.round((a.stats.avgClaimTimeSec ?? 0) / 60)}m claim`}
            />
          ))}
        </div>
      </div>

      <h2>Top comments by engagement</h2>
      {top.length === 0 ? (
        <div className="empty">No engagement recorded yet. The 6h sweep populates this.</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>Comment</th><th>Niche</th><th>Tone</th><th>Likes</th><th>Replies</th></tr></thead>
            <tbody>
              {top.map((c) => (
                <tr key={c.id}>
                  <td style={{ maxWidth: 380 }}>{c.text}</td>
                  <td>{c.nicheKey}</td>
                  <td>{c.tone ?? "–"}</td>
                  <td>{c.likes}</td>
                  <td>{c.replies}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>YouTube auto-comment opt-in</h2>
      <p className="subtle" style={{ marginTop: -6 }}>
        Suggest starting with 3–5 aged accounts as a pilot (Open item #2). Requires an OAuth token
        with the youtube.force-ssl scope on the account.
      </p>
      <OptInToggles
        accounts={ytAccounts.map((a) => ({
          id: a.id,
          handle: a.handle,
          ytAutoComment: a.ytAutoComment,
          hasToken: Boolean((a.authTokens as { accessToken?: string } | null)?.accessToken),
        }))}
      />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 }}>
      <span>{label}</span>
      <span className="subtle">{value}</span>
    </div>
  );
}
