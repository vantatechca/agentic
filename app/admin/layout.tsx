import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/server";

// All /admin/* pages are admin-only. Middleware guarantees authentication;
// this enforces the role.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/run");
  return <>{children}</>;
}
