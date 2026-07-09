"use client";

import { useState } from "react";

type Variant = {
  text: string;
  tone: string;
  lengthBand: string;
  riskNote: string | null;
  blocked?: boolean;
  blockReason?: string | null;
};

export type AlertCardData = {
  id: number;
  platform: string;
  nicheKey: string;
  postUrl: string;
  title: string | null;
  status: string;
  window: string | null;
  accountId: number | null;
  accountHandle: string | null;
  adsPowerProfileId: string | null;
  agentName: string | null;
};

export function AlertCard({ alert }: { alert: AlertCardData }) {
  const [variants, setVariants] = useState<Variant[]>([]);
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function generate() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/comments/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: alert.platform,
          nicheKey: alert.nicheKey,
          videoUrl: alert.postUrl,
          captionOrTitle: alert.title || alert.postUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(`Error: ${data.error?.message || JSON.stringify(data.error) || res.status}`);
      } else {
        setVariants(data.variants ?? []);
        if (data.oneCommentPerVideo && !data.oneCommentPerVideo.ok) {
          setMsg(`⚠️ ${data.oneCommentPerVideo.reason}`);
        }
      }
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  async function copyAndChoose(text: string) {
    setChosen(text);
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Copied to clipboard.");
    } catch {
      setMsg("Copy failed — select the text manually.");
    }
  }

  async function markDone() {
    if (!chosen || !alert.accountId) {
      setMsg("Choose a variant and ensure an account is assigned.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/alerts/${alert.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: alert.accountId, chosenText: chosen }),
      });
      const data = await res.json();
      if (!res.ok) setMsg(`Blocked: ${data.reason || res.status}`);
      else {
        setDone(true);
        setMsg("✅ Marked done — comment recorded.");
      }
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ opacity: done ? 0.6 : 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <span className={`badge ${alert.status}`}>{alert.status}</span>{" "}
          <span className="badge">{alert.platform}</span>{" "}
          <span className="badge">{alert.nicheKey}</span>
          <div style={{ fontWeight: 600, marginTop: 8 }}>{alert.title || "(new upload)"}</div>
          <a href={alert.postUrl} target="_blank" rel="noreferrer" className="mono">
            {alert.postUrl}
          </a>
        </div>
        <div style={{ textAlign: "right", fontSize: 12 }} className="subtle">
          {alert.window && <div>⏱️ {alert.window}</div>}
          {alert.accountHandle && <div>acct: {alert.accountHandle}</div>}
          {alert.adsPowerProfileId && <div>AdsPower: {alert.adsPowerProfileId}</div>}
          {alert.agentName && <div>agent: {alert.agentName}</div>}
        </div>
      </div>

      <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
        <button onClick={generate} disabled={loading || done}>
          {loading ? "…" : variants.length ? "Regenerate" : "Generate comments"}
        </button>
        <button className="ghost" onClick={markDone} disabled={loading || done || !chosen}>
          Mark done
        </button>
      </div>

      {msg && (
        <div className="subtle" style={{ marginTop: 8, fontSize: 12 }}>
          {msg}
        </div>
      )}

      {variants.length > 0 && (
        <div style={{ marginTop: 12 }}>
          {variants.map((v, i) => (
            <div key={i} className={`variant ${v.blocked ? "blocked" : ""}`}>
              <div>{v.text}</div>
              <div className="subtle" style={{ fontSize: 11, marginTop: 4 }}>
                {v.tone} · {v.lengthBand}
                {v.blocked ? ` · 🚫 ${v.blockReason}` : ""}
                {v.riskNote ? ` · ⚠️ ${v.riskNote}` : ""}
              </div>
              {!v.blocked && (
                <button
                  className="ghost"
                  style={{ marginTop: 6, padding: "4px 10px", fontSize: 12 }}
                  onClick={() => copyAndChoose(v.text)}
                >
                  {chosen === v.text ? "✓ chosen (copied)" : "Copy & choose"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
