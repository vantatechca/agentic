import type { Metadata } from "next";
import "./globals.css";
import { APP_NAME, APP_TAGLINE } from "@/config/app";

export const metadata: Metadata = {
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description: "SMM AI engagement platform: engagement tools + own-content scheduler at fleet scale.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <aside className="sidebar">
            <div className="brand">{APP_NAME}</div>
            <div className="tagline">{APP_TAGLINE}</div>
            <nav className="nav">
              <a href="/">Dashboard</a>
              <a href="/console">Agent Console</a>
              <a href="/studio">Studio</a>
              <a href="/admin">Admin</a>
              <a href="/admin/targets">↳ Watch Targets</a>
              <a href="/admin/trends">↳ Trend Radar</a>
              <a href="/admin/scheduler">↳ Scheduler</a>
            </nav>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
