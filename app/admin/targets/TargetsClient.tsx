"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Target = {
  id: number;
  platform: string;
  handle: string;
  nicheKey: string;
  channelId: string | null;
  enabled: boolean;
  consecutiveFailures: number;
  circuitOpen: boolean;
  lastCheckedAt: string | null;
};
type Niche = { key: string; name: string };

/**
 * Admin token is read from localStorage (set once via the field below) and sent
 * as x-admin-token. This keeps the P1 shared-secret gate usable without real
 * auth wiring; replace with a session when auth lands.
 */
function useAdminToken() {
  const [token, setToken] = useState<string>(
    typeof window !== "undefined" ? localStorage.getItem("adminToken") || "" : "",
  );
  const save = (t: string) => {
    setToken(t);
    if (typeof window !== "undefined") localStorage.setItem("adminToken", t);
  };
  return { token, save };
}

export function TargetsClient({
  targets,
  niches,
  apifyOn,
}: {
  targets: Target[];
  niches: Niche[];
  apifyOn: boolean;
}) {
  const router = useRouter();
  const { token, save } = useAdminToken();
  const [form, setForm] = useState({
    platform: "youtube",
    handle: "",
    nicheKey: niches[0]?.key ?? "restaurant",
  });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const headers = { "Content-Type": "application/json", "x-admin-token": token };

  async function addTarget() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/watch-targets", {
      method: "POST",
      headers,
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setMsg(res.ok ? `Added ${form.handle}` : `Error: ${data.error?.message || JSON.stringify(data.error) || data.error}`);
    setBusy(false);
    if (res.ok) router.refresh();
  }

  async function refresh(id: number) {
    setBusy(true);
    const res = await fetch(`/api/watch-targets/${id}/refresh`, { method: "POST", headers });
    const data = await res.json();
    setMsg(res.ok ? `Refreshed: ${JSON.stringify(data.result)}` : `Error: ${data.error}`);
    setBusy(false);
    router.refresh();
  }

  async function pollAll() {
    setBusy(true);
    const res = await fetch("/api/monitoring/poll", { method: "POST", headers, body: "{}" });
    const data = await res.json();
    setMsg(res.ok ? `Polled: ${JSON.stringify(data.results)}` : `Error: ${data.error}`);
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="subtle" style={{ fontSize: 12, marginBottom: 4 }}>Admin token</div>
        <input
          type="password"
          placeholder="ADMIN_API_TOKEN (stored locally)"
          value={token}
          onChange={(e) => save(e.target.value)}
        />
        <div className="subtle" style={{ fontSize: 11, marginTop: 6 }}>
          IG/TikTok scraping: {apifyOn ? "Apify enabled" : "free best-effort (expect circuit trips)"}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <h2 style={{ marginTop: 0 }}>Add target</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label>
            <div className="subtle" style={{ fontSize: 12 }}>Platform</div>
            <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} style={{ width: 140 }}>
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
            </select>
          </label>
          <label>
            <div className="subtle" style={{ fontSize: 12 }}>Handle / URL</div>
            <input value={form.handle} onChange={(e) => setForm({ ...form, handle: e.target.value })} placeholder="@channel or profile" style={{ width: 240 }} />
          </label>
          <label>
            <div className="subtle" style={{ fontSize: 12 }}>Niche</div>
            <select value={form.nicheKey} onChange={(e) => setForm({ ...form, nicheKey: e.target.value })} style={{ width: 160 }}>
              {(niches.length ? niches : [{ key: "restaurant", name: "Restaurant" }]).map((n) => (
                <option key={n.key} value={n.key}>{n.name}</option>
              ))}
            </select>
          </label>
          <button onClick={addTarget} disabled={busy || !form.handle}>Add</button>
          <button className="ghost" onClick={pollAll} disabled={busy}>Poll all now</button>
        </div>
        {msg && <div className="subtle mono" style={{ marginTop: 10, fontSize: 12 }}>{msg}</div>}
      </div>

      <h2>Targets ({targets.length})</h2>
      {targets.length === 0 ? (
        <div className="empty">No targets yet.</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead>
              <tr><th>Handle</th><th>Platform</th><th>Niche</th><th>Status</th><th>Last check</th><th></th></tr>
            </thead>
            <tbody>
              {targets.map((t) => (
                <tr key={t.id}>
                  <td>{t.handle}{t.channelId ? <div className="subtle mono" style={{ fontSize: 11 }}>{t.channelId}</div> : null}</td>
                  <td>{t.platform}</td>
                  <td>{t.nicheKey}</td>
                  <td>
                    {t.circuitOpen ? (
                      <span className="badge paused">circuit open</span>
                    ) : t.consecutiveFailures > 0 ? (
                      <span className="badge cooldown">{t.consecutiveFailures} fails</span>
                    ) : (
                      <span className="badge active">ok</span>
                    )}
                  </td>
                  <td className="subtle" style={{ fontSize: 12 }}>{t.lastCheckedAt ? new Date(t.lastCheckedAt).toLocaleString() : "never"}</td>
                  <td>
                    <button className="ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => refresh(t.id)} disabled={busy}>
                      Manual refresh
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
