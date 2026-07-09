"use client";

import { useState } from "react";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error || "Login failed");
      } else {
        const params = new URLSearchParams(window.location.search);
        window.location.href = params.get("next") || "/";
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <label style={{ display: "block", marginBottom: 10 }}>
        <div className="subtle" style={{ fontSize: 12, marginBottom: 4 }}>Email</div>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
      </label>
      <label style={{ display: "block", marginBottom: 14 }}>
        <div className="subtle" style={{ fontSize: 12, marginBottom: 4 }}>Password</div>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {err && <div style={{ color: "var(--bad)", fontSize: 13, marginBottom: 10 }}>{err}</div>}
      <button type="submit" disabled={busy} style={{ width: "100%" }}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
