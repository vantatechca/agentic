"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: number; email: string; name: string; role: string; active: boolean; lastLoginAt: string | null;
};
type Niche = { key: string; name: string };

export function UsersClient({ users, niches }: { users: User[]; niches: Niche[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "agent", niches: [] as string[] });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name, email: form.email, password: form.password, role: form.role,
        assignedNiches: form.niches,
      }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Created ${form.email}` : `Error: ${data.error?.message || JSON.stringify(data.error) || data.error}`);
    setBusy(false);
    if (res.ok) {
      setForm({ name: "", email: "", password: "", role: "agent", niches: [] });
      router.refresh();
    }
  }

  async function toggleActive(id: number, active: boolean) {
    setBusy(true);
    await fetch(`/api/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    setBusy(false);
    router.refresh();
  }

  async function resetPassword(id: number) {
    const pw = prompt("New password (min 8 chars):");
    if (!pw) return;
    setBusy(true);
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pw }),
    });
    setMsg(res.ok ? "Password reset." : "Reset failed.");
    setBusy(false);
  }

  return (
    <>
      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ marginTop: 0 }}>Add user</h2>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          <label><div className="subtle" style={{ fontSize: 12 }}>Name</div>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={{ width: 160 }} />
          </label>
          <label><div className="subtle" style={{ fontSize: 12 }}>Email</div>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ width: 200 }} />
          </label>
          <label><div className="subtle" style={{ fontSize: 12 }}>Password</div>
            <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="min 8 chars" style={{ width: 160 }} />
          </label>
          <label><div className="subtle" style={{ fontSize: 12 }}>Role</div>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} style={{ width: 120 }}>
              <option value="agent">Agent</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          {form.role === "agent" && niches.length > 0 && (
            <label><div className="subtle" style={{ fontSize: 12 }}>Niches (comma)</div>
              <input
                placeholder="restaurant, fitness"
                onChange={(e) => setForm({ ...form, niches: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                style={{ width: 180 }}
              />
            </label>
          )}
          <button onClick={create} disabled={busy || !form.name || !form.email || form.password.length < 8}>Create</button>
        </div>
        {msg && <div className="subtle mono" style={{ marginTop: 10, fontSize: 12 }}>{msg}</div>}
      </div>

      <h2>Users ({users.length})</h2>
      <div className="card" style={{ padding: 0 }}>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Last login</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td className="mono" style={{ fontSize: 12 }}>{u.email}</td>
                <td><span className={`badge ${u.role === "admin" ? "new" : ""}`}>{u.role}</span></td>
                <td><span className={`badge ${u.active ? "active" : "paused"}`}>{u.active ? "active" : "disabled"}</span></td>
                <td className="subtle" style={{ fontSize: 12 }}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : "never"}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  <button className="ghost" style={{ padding: "4px 8px", fontSize: 11 }} disabled={busy} onClick={() => resetPassword(u.id)}>Reset pw</button>
                  <button className="ghost" style={{ padding: "4px 8px", fontSize: 11 }} disabled={busy} onClick={() => toggleActive(u.id, !u.active)}>{u.active ? "Disable" : "Enable"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
