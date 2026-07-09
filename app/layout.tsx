import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME, APP_TAGLINE } from "@/config/app";
import { getCurrentUser } from "@/auth/server";
import { LogoutButton } from "./LogoutButton";

export const metadata: Metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description: "SMM AI engagement platform: engagement tools + own-content scheduler at fleet scale.",
};

type NavItem = { href: string; label: string; indent?: boolean };

const AGENT_NAV: NavItem[] = [
  { href: "/run", label: "Today's Run" },
  { href: "/console", label: "Agent Console" },
  { href: "/studio", label: "Studio" },
  { href: "/activity", label: "My Activity" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/admin", label: "Admin Control" },
  { href: "/admin/clients", label: "Clients", indent: true },
  { href: "/admin/users", label: "Users", indent: true },
  { href: "/admin/activity", label: "URL / Activity Log", indent: true },
  { href: "/admin/fleet", label: "Fleet Health", indent: true },
  { href: "/admin/targets", label: "Watch Targets", indent: true },
  { href: "/admin/trends", label: "Trend Radar", indent: true },
  { href: "/admin/scheduler", label: "Scheduler", indent: true },
  { href: "/admin/analytics", label: "Analytics", indent: true },
  { href: "/run", label: "Run Sheets" },
  { href: "/console", label: "Agent Console" },
  { href: "/studio", label: "Studio" },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  // Unauthenticated (login page) renders bare — no shell.
  if (!user) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  const nav = user.role === "admin" ? ADMIN_NAV : AGENT_NAV;

  return (
    <html lang="en">
      <body>
        <div className="layout">
          <aside className="sidebar">
            <div className="brand">{APP_NAME}</div>
            <div className="tagline">{APP_TAGLINE}</div>
            <nav className="nav">
              {nav.map((n) => (
                <a key={n.href} href={n.href} style={n.indent ? { paddingLeft: 20, fontSize: 13 } : undefined}>
                  {n.indent ? "↳ " : ""}
                  {n.label}
                </a>
              ))}
            </nav>
            <div className="sidebar-user">
              <div style={{ fontWeight: 600 }}>{user.name}</div>
              <div className="subtle" style={{ fontSize: 11 }}>
                {user.email} · {user.role}
              </div>
              <LogoutButton />
            </div>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
