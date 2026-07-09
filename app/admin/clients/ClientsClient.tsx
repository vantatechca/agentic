"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Client = {
  id: number; name: string; nicheKey: string | null; assignedAgentId: number | null;
  platforms: string[]; peakHours: string | null; status: string;
};
type Agent = { id: number; name: string };
type Niche = { key: string; name: string };
type Platform = { key: string; label: string };
type Block = { start: string; end: string; label: string; type: "watch" | "post" | "admin"; done: boolean };

export function ClientsClient({
  clients, agents, niches, platforms,
}: { clients: Client[]; agents: Agent[]; niches: Niche[]; platforms: Platform[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<number | null>(null);

  const [form, setForm] = useState({
    name: "", nicheKey: "", assignedAgentId: "", peakHours: "", platforms: [] as string[],
  });

  function togglePlatform(list: string[], key: string): string[] {
    return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
  }

  async function create() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/clients", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        nicheKey: form.nicheKey || undefined,
        assignedAgentId: form.assignedAgentId ? Number(form.assignedAgentId) : null,
        platforms: form.platforms,
        peakHours: form.peakHours || undefined,
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Created ${form.name}` : `Error: ${data.error?.message || JSON.stringify(data.error)}`);
    setBusy(false);
    if (res.ok) { setForm({ name: "", nicheKey: "", assignedAgentId: "", peakHours: "", platforms: [] }); router.refresh(); }
  }

  async function patchClient(id: number, patch: Record<string, unknown>) {
    setBusy(true);
    await fetch(`/api/clients/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Add client</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label><div className="subtle" style={{ fontSize: 12 }}>Brand name</div>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ width: 180 }} />
          </label>
          <label><div className="subtle" style={{ fontSize: 12 }}>Niche</div>
            <select value={form.nicheKey} onChange={(e) => setForm({ ...form, nicheKey: e.target.value })} style={{ width: 150 }}>
              <option value="">—</option>
              {niches.map((n) => <option key={n.key} value={n.key}>{n.name}</option>)}
            </select>
          </label>
          <label><div className="subtle" style={{ fontSize: 12 }}>Assign agent</div>
            <select value={form.assignedAgentId} onChange={(e) => setForm({ ...form, assignedAgentId: e.target.value })} style={{ width: 160 }}>
              <option value="">— unassigned</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <label><div className="subtle" style={{ fontSize: 12 }}>Peak hours</div>
            <input value={form.peakHours} onChange={(e) => setForm({ ...form, peakHours: e.target.value })} placeholder="11:00-14:00, 18:00-21:00" style={{ width: 200 }} />
          </label>
        </div>
        <div style={{ marginTop: 10 }}>
          <div className="subtle" style={{ fontSize: 12, marginBottom: 4 }}>Platforms</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {platforms.map((p) => (
              <label key={p.key} style={{ display: "flex", gap: 5, alignItems: "center", width: "auto" }}>
                <input type="checkbox" style={{ width: "auto" }} checked={form.platforms.includes(p.key)}
                  onChange={() => setForm({ ...form, platforms: togglePlatform(form.platforms, p.key) })} />
                <span style={{ fontSize: 13 }}>{p.label}</span>
              </label>
            ))}
          </div>
        </div>
        <button style={{ marginTop: 12 }} onClick={create} disabled={busy || !form.name}>Create client</button>
        {msg && <div className="subtle mono" style={{ marginTop: 10, fontSize: 12 }}>{msg}</div>}
      </div>

      <h2>Clients ({clients.length})</h2>
      {clients.length === 0 ? (
        <div className="empty">No clients yet.</div>
      ) : (
        clients.map((c) => (
          <div className="card" key={c.id} style={{ marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}
                  <span className={`badge ${c.status === "active" ? "active" : "cooldown"}`} style={{ marginLeft: 8 }}>{c.status}</span>
                </div>
                <div className="subtle" style={{ fontSize: 12, marginTop: 4 }}>
                  {c.nicheKey ?? "no niche"} · platforms: {c.platforms.join(", ") || "none"} · peak {c.peakHours ?? "—"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select value={c.assignedAgentId ?? ""} disabled={busy}
                  onChange={(e) => patchClient(c.id, { assignedAgentId: e.target.value ? Number(e.target.value) : null })} style={{ width: 150 }}>
                  <option value="">— unassigned</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <button className="ghost" style={{ padding: "6px 10px", fontSize: 12 }} disabled={busy}
                  onClick={() => patchClient(c.id, { status: c.status === "active" ? "paused" : "active" })}>
                  {c.status === "active" ? "Pause" : "Activate"}
                </button>
                <button className="ghost" style={{ padding: "6px 10px", fontSize: 12 }}
                  onClick={() => setEditing(editing === c.id ? null : c.id)}>
                  {editing === c.id ? "Close" : "Run sheet"}
                </button>
              </div>
            </div>
            <div style={{ marginTop: 8 }}>
              <div className="subtle" style={{ fontSize: 12, marginBottom: 4 }}>Platforms</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {platforms.map((p) => (
                  <label key={p.key} style={{ display: "flex", gap: 5, alignItems: "center", width: "auto" }}>
                    <input type="checkbox" style={{ width: "auto" }} checked={c.platforms.includes(p.key)} disabled={busy}
                      onChange={() => patchClient(c.id, { platforms: togglePlatform(c.platforms, p.key) })} />
                    <span style={{ fontSize: 13 }}>{p.label}</span>
                  </label>
                ))}
              </div>
            </div>
            {editing === c.id && <RunSheetEditor clientId={c.id} platforms={platforms.filter((p) => c.platforms.includes(p.key))} />}
          </div>
        ))
      )}
    </>
  );
}

function RunSheetEditor({ clientId, platforms }: { clientId: number; platforms: Platform[] }) {
  const [sheet, setSheet] = useState<{ id: number; quotas: Record<string, number>; blocks: Block[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/run-sheets?clientId=${clientId}`);
      const data = await res.json();
      if (!cancelled && res.ok) {
        setSheet({ id: data.sheet.id, quotas: data.sheet.quotas, blocks: data.sheet.blocks });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function save() {
    if (!sheet) return;
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/run-sheets/${sheet.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quotas: sheet.quotas, blocks: sheet.blocks }),
    });
    setMsg(res.ok ? "Saved." : "Save failed.");
    setBusy(false);
  }

  if (!sheet) return <div className="subtle" style={{ marginTop: 12, fontSize: 12 }}>Loading run sheet…</div>;

  const setBlock = (i: number, patch: Partial<Block>) =>
    setSheet({ ...sheet, blocks: sheet.blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) });

  return (
    <div style={{ marginTop: 14, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
      <div className="stat-label" style={{ marginBottom: 8 }}>Daily comment quotas (today)</div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {platforms.map((p) => (
          <label key={p.key}><div className="subtle" style={{ fontSize: 12 }}>{p.label}</div>
            <input type="number" min={0} value={sheet.quotas[p.key] ?? 0} style={{ width: 80 }}
              onChange={(e) => setSheet({ ...sheet, quotas: { ...sheet.quotas, [p.key]: Number(e.target.value) } })} />
          </label>
        ))}
        {platforms.length === 0 && <div className="subtle" style={{ fontSize: 12 }}>Enable platforms above first.</div>}
      </div>

      <div className="stat-label" style={{ margin: "16px 0 8px" }}>Time blocks (tasks for the agent)</div>
      {sheet.blocks.map((b, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
          <input value={b.start} onChange={(e) => setBlock(i, { start: e.target.value })} style={{ width: 64 }} />
          <input value={b.end} onChange={(e) => setBlock(i, { end: e.target.value })} style={{ width: 64 }} />
          <input value={b.label} onChange={(e) => setBlock(i, { label: e.target.value })} style={{ flex: 1, minWidth: 200, maxWidth: "none" }} />
          <select value={b.type} onChange={(e) => setBlock(i, { type: e.target.value as Block["type"] })} style={{ width: 100 }}>
            <option value="watch">watch</option><option value="post">post</option><option value="admin">admin</option>
          </select>
          <button className="ghost" style={{ padding: "4px 8px", fontSize: 11 }}
            onClick={() => setSheet({ ...sheet, blocks: sheet.blocks.filter((_, idx) => idx !== i) })}>✕</button>
        </div>
      ))}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button className="ghost" style={{ fontSize: 12 }}
          onClick={() => setSheet({ ...sheet, blocks: [...sheet.blocks, { start: "00:00", end: "00:00", label: "New task", type: "watch", done: false }] })}>
          + Add block
        </button>
        <button onClick={save} disabled={busy}>Save run sheet</button>
        {msg && <span className="subtle" style={{ fontSize: 12, alignSelf: "center" }}>{msg}</span>}
      </div>
    </div>
  );
}
