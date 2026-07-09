"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Platform = { key: string; label: string };
type ActionType = { key: string; label: string; countsToQuota: boolean };
type Block = { start: string; end: string; label: string; type: "watch" | "post" | "admin"; done: boolean };
type Sheet = {
  id: number;
  clientId: number;
  date: string;
  quotas: Record<string, number>;
  blocks: Block[];
  counts: Record<string, number>;
};

export function RunClient({
  isAdmin,
  clients,
  client,
  platforms,
  actionTypes,
  sheet,
}: {
  isAdmin: boolean;
  clients: { id: number; name: string }[];
  client: { id: number; name: string; peakHours: string | null };
  platforms: Platform[];
  actionTypes: ActionType[];
  sheet: Sheet;
}) {
  const router = useRouter();
  const [blocks, setBlocks] = useState<Block[]>(sheet.blocks);
  const [counts, setCounts] = useState<Record<string, number>>(sheet.counts);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function toggle(index: number, done: boolean) {
    setBlocks((b) => b.map((x, i) => (i === index ? { ...x, done } : x)));
    await fetch(`/api/run-sheets/${sheet.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toggle: { index, done } }),
    }).catch(() => {});
  }

  // Log-action form
  const [form, setForm] = useState({
    platform: platforms[0]?.key ?? "",
    actionType: "comment",
    targetUrl: "",
    resultUrl: "",
    note: "",
  });

  async function logAction(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        clientId: client.id,
        platform: form.platform,
        actionType: form.actionType,
      };
      if (form.targetUrl) body.targetUrl = form.targetUrl;
      if (form.resultUrl) body.resultUrl = form.resultUrl;
      if (form.note) body.note = form.note;
      const res = await fetch("/api/action-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Error: ${data.error?.message || JSON.stringify(data.error) || data.error}`);
      } else {
        setMsg("Logged.");
        if (form.actionType === "comment") {
          setCounts((c) => ({ ...c, [form.platform]: (c[form.platform] ?? 0) + 1 }));
        }
        setForm((f) => ({ ...f, targetUrl: "", resultUrl: "", note: "" }));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ marginBottom: 0 }}>Today&apos;s run</h1>
        {clients.length > 1 && (
          <select
            value={client.id}
            onChange={(e) => router.push(`/run?clientId=${e.target.value}`)}
            style={{ width: 220 }}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>
      <p className="subtle">
        One operator, one brand: ~4-5 hours watching, ~2-3 hours posting. Quotas are account-level;
        the meters fill as you log posted actions. Brand: <strong>{client.name}</strong>
        {client.peakHours ? ` · peak hours ${client.peakHours}` : ""}.
      </p>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="stat-label" style={{ marginBottom: 12 }}>Outbound comment quota, today</div>
        <div className="quota-grid">
          {platforms.length === 0 && <div className="subtle">No platforms enabled for this client.</div>}
          {platforms.map((p) => {
            const used = counts[p.key] ?? 0;
            const target = sheet.quotas[p.key] ?? 0;
            const pct = target > 0 ? Math.min(100, (used / target) * 100) : 0;
            const full = target > 0 && used >= target;
            return (
              <div className="quota-card" key={p.key}>
                <div className="plat">{p.label}</div>
                <div className="nums">
                  {used} <span className="target">/ {target}</span>
                </div>
                <div className={`meter ${full ? "full" : ""}`}>
                  <span style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        <div className="subtle" style={{ fontSize: 12, marginTop: 10 }}>
          Replies on the brand&apos;s own posts and inbound DMs are unlimited at human pace, only
          outbound counts here. If a platform meter is full, stop posting there until tomorrow.
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="stat-label" style={{ marginBottom: 12 }}>Time blocks, check off as you go</div>
        {blocks.map((b, i) => (
          <div className={`block-row ${b.done ? "done" : ""}`} key={i}>
            <input type="checkbox" checked={b.done} onChange={(e) => toggle(i, e.target.checked)} />
            <span className="time">{b.start}–{b.end}</span>
            <span className="label">{b.label}</span>
            <span className={`tag ${b.type}`}>{b.type}</span>
          </div>
        ))}
        <div className="subtle" style={{ fontSize: 12, marginTop: 8 }}>
          Order the blocks around the brand&apos;s peak hours (set by admin). WATCH = logged-out
          research browser. POST = the only time you touch the brand account.
          {isAdmin && " Edit blocks/quotas in Admin → Clients."}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="stat-label" style={{ marginBottom: 12 }}>Log an action (fills the quota + records the URL)</div>
        <form onSubmit={logAction} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label>
            <div className="subtle" style={{ fontSize: 12 }}>Platform</div>
            <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} style={{ width: 130 }}>
              {platforms.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
            </select>
          </label>
          <label>
            <div className="subtle" style={{ fontSize: 12 }}>Action</div>
            <select value={form.actionType} onChange={(e) => setForm({ ...form, actionType: e.target.value })} style={{ width: 160 }}>
              {actionTypes.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
            </select>
          </label>
          <label>
            <div className="subtle" style={{ fontSize: 12 }}>Target URL (post acted on)</div>
            <input value={form.targetUrl} onChange={(e) => setForm({ ...form, targetUrl: e.target.value })} placeholder="https://…" style={{ width: 240 }} />
          </label>
          <label>
            <div className="subtle" style={{ fontSize: 12 }}>Result URL (our comment/post)</div>
            <input value={form.resultUrl} onChange={(e) => setForm({ ...form, resultUrl: e.target.value })} placeholder="https://…" style={{ width: 240 }} />
          </label>
          <button type="submit" disabled={busy || !form.platform}>Log</button>
        </form>
        {msg && <div className="subtle mono" style={{ marginTop: 8, fontSize: 12 }}>{msg}</div>}
      </div>
    </>
  );
}
