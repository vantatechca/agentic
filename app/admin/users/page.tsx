import { desc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { listNiches } from "@/niches/registry";
import { capabilities } from "@/env";
import { UsersClient } from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  if (!capabilities.hasDb) {
    return (<><h1>Users</h1><div className="empty">Database not configured.</div></>);
  }
  const [rows, niches] = await Promise.all([
    db
      .select({
        id: users.id, email: users.email, name: users.name, role: users.role,
        active: users.active, lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(200),
    listNiches().catch(() => []),
  ]);

  return (
    <>
      <h1>Users</h1>
      <p className="subtle">Create login accounts. Agents get an operator profile automatically and can be assigned clients.</p>
      <UsersClient
        users={rows.map((u) => ({
          id: u.id, email: u.email, name: u.name, role: u.role,
          active: u.active, lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        }))}
        niches={niches.map((n) => ({ key: n.key, name: n.name }))}
      />
    </>
  );
}
