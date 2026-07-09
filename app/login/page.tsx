import { redirect } from "next/navigation";
import { getCurrentUser } from "@/auth/server";
import { APP_NAME } from "@/config/app";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <div className="card" style={{ width: 360, maxWidth: "100%" }}>
        <div className="brand" style={{ fontSize: 22 }}>{APP_NAME}</div>
        <div className="subtle" style={{ marginBottom: 18, fontSize: 13 }}>Sign in to continue</div>
        <LoginForm />
      </div>
    </div>
  );
}
