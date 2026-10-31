"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useApp, type SessionUser } from "@/lib/state";

export default function LoginPage() {
  const { t } = useI18n();
  const { setSession, refresh } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState("adi@demo.local");
  const [password, setPassword] = useState("DemoPass123!");
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="panel mx-auto max-w-md space-y-3 p-5" onSubmit={async (event) => {
      event.preventDefault();
      setError(null);
      try {
        const body = await api<{ user: SessionUser }>("/api/v1/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
        setSession(body.user);
        await refresh();
        router.push("/watchlist");
      } catch {
        setError("N/A");
      }
    }}>
      <h1 className="text-xl font-semibold">{t("login")}</h1>
      <div className="rounded border border-accent/40 bg-accent/10 p-3 text-xs text-accent">{t("demoAccount")}: adi@demo.local / DemoPass123!</div>
      <label className="block text-xs text-muted">{t("email")}<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="block text-xs text-muted">{t("password")}<Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {error && <p className="text-sm text-down">{error}</p>}
      <Button type="submit">{t("login")}</Button>
      <p className="text-xs text-muted"><Link className="text-info" href="/register">{t("register")}</Link></p>
    </form>
  );
}
