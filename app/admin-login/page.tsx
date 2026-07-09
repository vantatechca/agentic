import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/server";
import { APP_NAME } from "@/config/app";
import { LoginForm } from "../login/LoginForm";

export const dynamic = "force-dynamic";

// Separate admin sign-in door (reached by URL, not linked in the operator nav).
export default async function AdminLoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : "/run");
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card" style={{ width: 360, maxWidth: "100%" }}>
        <div className="brand" style={{ fontSize: 22 }}>{APP_NAME}</div>
        <div className="subtle" style={{ marginBottom: 18, fontSize: 13 }}>Admin sign in</div>
        <LoginForm scope="admin" defaultNext="/admin" />
      </div>
    </div>
  );
}
