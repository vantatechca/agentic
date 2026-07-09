import { desc } from "drizzle-orm";
import { db } from "@/db";
import { accounts, niches, agents, watchTargets } from "@/db/schema";
import { capabilities } from "@/env";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!capabilities.hasDb) {
    return (
      <>
        <h1>Admin</h1>
        <div className="empty">Database not configured.</div>
      </>
    );
  }

  const [acctRows, nicheRows, agentRows, targetRows] = await Promise.all([
    db.select().from(accounts).orderBy(desc(accounts.healthScore)).limit(100),
    db.select().from(niches),
    db.select().from(agents),
    db.select().from(watchTargets).limit(100),
  ]);

  return (
    <>
      <h1>Admin — Fleet Health</h1>
      <p className="subtle">Account budgets, cooldowns, niches, agents, watch targets.</p>

      <h2>Accounts ({acctRows.length})</h2>
      {acctRows.length === 0 ? (
        <div className="empty">No accounts yet. Seed or add via the API.</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr>
                <th>Handle</th><th>Platform</th><th>Niche</th><th>Health</th>
                <th>Status</th><th>Budget</th><th>AdsPower</th>
              </tr>
            </thead>
            <tbody>
              {acctRows.map((a) => (
                <tr key={a.id}>
                  <td>{a.handle}</td>
                  <td>{a.platform}</td>
                  <td>{a.nicheKey}</td>
                  <td>{a.healthScore}</td>
                  <td><span className={`badge ${a.status}`}>{a.status}</span></td>
                  <td>{a.dailyCommentBudget}c / {a.dailyPostBudget}p</td>
                  <td className="mono">{a.adsPowerProfileId ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2>Niches ({nicheRows.length})</h2>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>Key</th><th>Name</th><th>Tones</th><th>Evergreen tags</th><th>Banned</th></tr>
          </thead>
          <tbody>
            {nicheRows.map((n) => (
              <tr key={n.id}>
                <td className="mono">{n.key}</td>
                <td>{n.name}</td>
                <td>{n.commentTones.join(", ")}</td>
                <td className="mono">{n.hashtagBank.evergreen.slice(0, 4).join(" ")}</td>
                <td>{n.bannedWords.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid cols-3" style={{ marginTop: 20 }}>
        <div className="card">
          <div className="stat">{agentRows.length}</div>
          <div className="stat-label">Agents</div>
          <div className="subtle" style={{ marginTop: 6, fontSize: 12 }}>
            {agentRows.map((a) => a.name).join(", ") || "none"}
          </div>
        </div>
        <div className="card">
          <div className="stat">{targetRows.length}</div>
          <div className="stat-label">Watch targets</div>
        </div>
        <div className="card">
          <div className="stat">{targetRows.filter((t) => t.circuitOpenUntil).length}</div>
          <div className="stat-label">Circuits open</div>
        </div>
      </div>
    </>
  );
}
