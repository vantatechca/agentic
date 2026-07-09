"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Account = { id: number; handle: string; platform: string; nicheKey: string };
type Media = { id: number; kind: string; url: string | null; description: string | null };
type Post = {
  id: number;
  platform: string;
  accountId: number;
  caption: string | null;
  status: string;
  scheduledAt: string;
  postedUrl: string | null;
  error: string | null;
};

export function SchedulerClient({
  accounts,
  media,
  posts,
}: {
  accounts: Account[];
  media: Media[];
  posts: Post[];
}) {
  const router = useRouter();
  const [token, setToken] = useState<string>(
    typeof window !== "undefined" ? localStorage.getItem("adminToken") || "" : "",
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const headers = { "Content-Type": "application/json", "x-admin-token": token };

  function saveToken(t: string) {
    setToken(t);
    if (typeof window !== "undefined") localStorage.setItem("adminToken", t);
  }

  // media register form
  const [mediaForm, setMediaForm] = useState({ kind: "image", url: "", description: "" });
  async function addMedia() {
    setBusy(true);
    const res = await fetch("/api/media", { method: "POST", headers, body: JSON.stringify(mediaForm) });
    const data = await res.json();
    setMsg(res.ok ? `Media #${data.id} registered` : `Error: ${data.error?.message || data.error}`);
    setBusy(false);
    router.refresh();
  }

  // schedule form
  const [form, setForm] = useState({
    accountId: accounts[0]?.id ?? 0,
    scheduledAt: "",
    mediaId: "",
    caption: "",
    genTopic: "",
    genMedia: "",
    genCta: "drive visits",
    useGen: true,
  });

  async function schedule() {
    setBusy(true);
    setMsg(null);
    const body: Record<string, unknown> = {
      accountId: Number(form.accountId),
      scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : new Date().toISOString(),
    };
    if (form.mediaId) body.mediaId = Number(form.mediaId);
    if (form.useGen) {
      body.generate = { topic: form.genTopic, mediaDescription: form.genMedia, ctaGoal: form.genCta };
    } else if (form.caption) {
      body.caption = form.caption;
    }
    const res = await fetch("/api/scheduled-posts", { method: "POST", headers, body: JSON.stringify(body) });
    const data = await res.json();
    setMsg(res.ok ? `Scheduled post #${data.id}` : `Error: ${data.error?.message || JSON.stringify(data.error)}`);
    setBusy(false);
    router.refresh();
  }

  async function publishNow(id: number) {
    setBusy(true);
    const res = await fetch(`/api/scheduled-posts/${id}/publish`, { method: "POST", headers });
    const data = await res.json();
    setMsg(res.ok ? `Publish: ${data.status}` : `Error: ${data.error}`);
    setBusy(false);
    router.refresh();
  }

  return (
    <>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="subtle" style={{ fontSize: 12 }}>Admin token</div>
        <input type="password" value={token} onChange={(e) => saveToken(e.target.value)} placeholder="ADMIN_API_TOKEN" />
      </div>

      <div className="grid" style={{ gridTemplateColumns: "1fr 1fr", marginTop: 14, gap: 14 }}>
        <div className="card">
          <h2 style={{ marginTop: 0 }}>Register media</h2>
          <label><div className="subtle" style={{ fontSize: 12 }}>Kind</div>
            <select value={mediaForm.kind} onChange={(e) => setMediaForm({ ...mediaForm, kind: e.target.value })}>
              <option value="image">Image</option><option value="video">Video</option>
            </select>
          </label>
          <label><div className="subtle" style={{ fontSize: 12, marginTop: 8 }}>Public URL</div>
            <input value={mediaForm.url} onChange={(e) => setMediaForm({ ...mediaForm, url: e.target.value })} placeholder="https://…" />
          </label>
          <label><div className="subtle" style={{ fontSize: 12, marginTop: 8 }}>Description</div>
            <input value={mediaForm.description} onChange={(e) => setMediaForm({ ...mediaForm, description: e.target.value })} />
          </label>
          <button style={{ marginTop: 10 }} onClick={addMedia} disabled={busy || !mediaForm.url}>Register</button>
          <div className="subtle" style={{ fontSize: 12, marginTop: 10 }}>{media.length} assets in library</div>
        </div>

        <div className="card">
          <h2 style={{ marginTop: 0 }}>Schedule a post</h2>
          <label><div className="subtle" style={{ fontSize: 12 }}>Account</div>
            <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: Number(e.target.value) })}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.handle} ({a.platform})</option>)}
            </select>
          </label>
          <label><div className="subtle" style={{ fontSize: 12, marginTop: 8 }}>When</div>
            <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
          </label>
          <label><div className="subtle" style={{ fontSize: 12, marginTop: 8 }}>Media</div>
            <select value={form.mediaId} onChange={(e) => setForm({ ...form, mediaId: e.target.value })}>
              <option value="">(none)</option>
              {media.map((m) => <option key={m.id} value={m.id}>#{m.id} {m.kind} {m.description ?? m.url}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 8 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={form.useGen} onChange={(e) => setForm({ ...form, useGen: e.target.checked })} />
            <span className="subtle" style={{ fontSize: 12 }}>Generate caption</span>
          </label>
          {form.useGen ? (
            <>
              <input style={{ marginTop: 6 }} placeholder="topic" value={form.genTopic} onChange={(e) => setForm({ ...form, genTopic: e.target.value })} />
              <input style={{ marginTop: 6 }} placeholder="media description" value={form.genMedia} onChange={(e) => setForm({ ...form, genMedia: e.target.value })} />
              <input style={{ marginTop: 6 }} placeholder="CTA goal" value={form.genCta} onChange={(e) => setForm({ ...form, genCta: e.target.value })} />
            </>
          ) : (
            <textarea style={{ marginTop: 6 }} rows={3} placeholder="caption" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} />
          )}
          <button style={{ marginTop: 10 }} onClick={schedule} disabled={busy || !form.accountId}>Schedule</button>
        </div>
      </div>
      {msg && <div className="subtle mono" style={{ marginTop: 10, fontSize: 12 }}>{msg}</div>}

      <h2>Scheduled posts ({posts.length})</h2>
      {posts.length === 0 ? (
        <div className="empty">No scheduled posts.</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table>
            <thead><tr><th>ID</th><th>Platform</th><th>When</th><th>Status</th><th>Caption</th><th></th></tr></thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id}>
                  <td>#{p.id}</td>
                  <td>{p.platform}</td>
                  <td className="subtle" style={{ fontSize: 12 }}>{new Date(p.scheduledAt).toLocaleString()}</td>
                  <td>
                    <span className={`badge ${p.status === "posted" ? "active" : p.status === "failed" ? "paused" : p.status === "needs_human" ? "cooldown" : "new"}`}>{p.status}</span>
                    {p.error && <div className="subtle" style={{ fontSize: 11 }}>{p.error}</div>}
                    {p.postedUrl && <a href={p.postedUrl} target="_blank" rel="noreferrer" className="mono" style={{ fontSize: 11 }}>link</a>}
                  </td>
                  <td className="subtle" style={{ fontSize: 12, maxWidth: 240 }}>{(p.caption ?? "").slice(0, 80)}</td>
                  <td>
                    {(p.status === "queued" || p.status === "needs_human") && (
                      <button className="ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={() => publishNow(p.id)} disabled={busy}>Publish now</button>
                    )}
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
