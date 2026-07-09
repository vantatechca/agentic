"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Acct = { id: number; handle: string; ytAutoComment: boolean; hasToken: boolean };

export function OptInToggles({ accounts }: { accounts: Acct[] }) {
  const router = useRouter();
  const [token, setToken] = useState<string>(
    typeof window !== "undefined" ? localStorage.getItem("adminToken") || "" : "",
  );
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function saveToken(t: string) {
    setToken(t);
    if (typeof window !== "undefined") localStorage.setItem("adminToken", t);
  }

  async function toggle(id: number, next: boolean) {
    setBusy(true);
    const res = await fetch(`/api/accounts/${id}/opt-in`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ ytAutoComment: next }),
    });
    const data = await res.json();
    setMsg(res.ok ? `#${id} → ${next ? "opted in" : "opted out"}` : `Error: ${data.error?.message || data.error}`);
    setBusy(false);
    router.refresh();
  }

  if (accounts.length === 0) return <div className="empty">No YouTube accounts.</div>;

  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="subtle" style={{ fontSize: 12 }}>Admin token</div>
        <input type="password" value={token} onChange={(e) => saveToken(e.target.value)} placeholder="ADMIN_API_TOKEN" />
      </div>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Handle</th><th>OAuth token</th><th>Auto-comment</th><th></th></tr></thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.handle}</td>
                <td>{a.hasToken ? <span className="badge active">present</span> : <span className="badge paused">missing</span>}</td>
                <td>{a.ytAutoComment ? <span className="badge active">on</span> : <span className="badge">off</span>}</td>
                <td>
                  <button className="ghost" style={{ padding: "4px 10px", fontSize: 12 }} disabled={busy} onClick={() => toggle(a.id, !a.ytAutoComment)}>
                    {a.ytAutoComment ? "Opt out" : "Opt in"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {msg && <div className="subtle mono" style={{ marginTop: 8, fontSize: 12 }}>{msg}</div>}
    </>
  );
}
