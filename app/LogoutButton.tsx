"use client";

export function LogoutButton() {
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  return (
    <button className="ghost" style={{ marginTop: 10, width: "100%", fontSize: 12 }} onClick={logout}>
      Sign out
    </button>
  );
}
