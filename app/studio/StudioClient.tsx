"use client";

import { useState } from "react";

type Niche = { key: string; name: string };

export function StudioClient({ niches }: { niches: Niche[] }) {
  const [tab, setTab] = useState<"comment" | "caption">("comment");
  return (
    <>
      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        <button className={tab === "comment" ? "" : "ghost"} onClick={() => setTab("comment")}>
          Comment Studio
        </button>
        <button className={tab === "caption" ? "" : "ghost"} onClick={() => setTab("caption")}>
          Caption Studio
        </button>
      </div>
      {tab === "comment" ? <CommentForm niches={niches} /> : <CaptionForm niches={niches} />}
    </>
  );
}

function nicheOptions(niches: Niche[]) {
  const base = niches.length ? niches : [{ key: "restaurant", name: "Restaurant" }, { key: "fitness", name: "Fitness" }, { key: "finance", name: "Finance" }];
  return base.map((n) => (
    <option key={n.key} value={n.key}>
      {n.name}
    </option>
  ));
}

function CommentForm({ niches }: { niches: Niche[] }) {
  const [form, setForm] = useState({
    platform: "youtube",
    nicheKey: niches[0]?.key ?? "restaurant",
    videoUrl: "https://www.youtube.com/watch?v=example",
    captionOrTitle: "",
  });
  const [out, setOut] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setOut(null);
    const res = await fetch("/api/comments/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setOut(await res.json());
    setLoading(false);
  }

  return (
    <div className="card">
      <Field label="Platform">
        <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
          <option value="youtube">YouTube</option>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
        </select>
      </Field>
      <Field label="Niche">
        <select value={form.nicheKey} onChange={(e) => setForm({ ...form, nicheKey: e.target.value })}>
          {nicheOptions(niches)}
        </select>
      </Field>
      <Field label="Video URL">
        <input value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />
      </Field>
      <Field label="Caption / Title">
        <input
          value={form.captionOrTitle}
          onChange={(e) => setForm({ ...form, captionOrTitle: e.target.value })}
          placeholder="The post's caption or video title"
        />
      </Field>
      <button onClick={run} disabled={loading || !form.captionOrTitle}>
        {loading ? "Generating…" : "Generate 5 variants"}
      </button>
      {out?.variants && (
        <div style={{ marginTop: 12 }}>
          {out.variants.map((v: any, i: number) => (
            <div key={i} className={`variant ${v.blocked ? "blocked" : ""}`}>
              <div>{v.text}</div>
              <div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>
                {v.tone} · {v.lengthBand}
                {v.blocked ? ` · 🚫 ${v.blockReason}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
      {out?.error && <pre className="mono" style={{ color: "var(--bad)" }}>{JSON.stringify(out.error, null, 2)}</pre>}
    </div>
  );
}

function CaptionForm({ niches }: { niches: Niche[] }) {
  const [form, setForm] = useState({
    platform: "instagram",
    nicheKey: niches[0]?.key ?? "restaurant",
    topic: "",
    mediaDescription: "",
    ctaGoal: "drive visits",
  });
  const [out, setOut] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setOut(null);
    const res = await fetch("/api/captions/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setOut(await res.json());
    setLoading(false);
  }

  return (
    <div className="card">
      <Field label="Platform">
        <select value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}>
          <option value="instagram">Instagram</option>
          <option value="tiktok">TikTok</option>
          <option value="youtube">YouTube</option>
        </select>
      </Field>
      <Field label="Niche">
        <select value={form.nicheKey} onChange={(e) => setForm({ ...form, nicheKey: e.target.value })}>
          {nicheOptions(niches)}
        </select>
      </Field>
      <Field label="Topic">
        <input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} />
      </Field>
      <Field label="Media description">
        <input value={form.mediaDescription} onChange={(e) => setForm({ ...form, mediaDescription: e.target.value })} />
      </Field>
      <Field label="CTA goal">
        <input value={form.ctaGoal} onChange={(e) => setForm({ ...form, ctaGoal: e.target.value })} />
      </Field>
      <button onClick={run} disabled={loading || !form.topic}>
        {loading ? "Generating…" : "Generate caption"}
      </button>
      {out?.caption && (
        <div className="variant" style={{ marginTop: 12 }}>
          <div style={{ whiteSpace: "pre-wrap" }}>{out.caption}</div>
          {out.ytTitle && <div className="subtle" style={{ marginTop: 6 }}>YT title: {out.ytTitle}</div>}
          <div className="mono" style={{ marginTop: 6, color: "var(--accent)" }}>{out.hashtags?.join(" ")}</div>
          {out.captionScrub && !out.captionScrub.ok && (
            <div style={{ color: "var(--bad)", marginTop: 6 }}>🚫 {out.captionScrub.reason}</div>
          )}
        </div>
      )}
      {out?.error && <pre className="mono" style={{ color: "var(--bad)" }}>{JSON.stringify(out.error, null, 2)}</pre>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 10 }}>
      <div className="subtle" style={{ fontSize: 12, marginBottom: 4 }}>{label}</div>
      {children}
    </label>
  );
}
