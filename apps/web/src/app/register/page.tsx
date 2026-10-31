"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useApp, type SessionUser } from "@/lib/state";

export default function RegisterPage() {
  const { t } = useI18n();
  const { setSession, refresh } = useApp();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <form className="panel mx-auto max-w-md space-y-3 p-5" onSubmit={async (event) => {
      event.preventDefault();
      setError(null);
      try {
        const body = await api<{ user: SessionUser }>("/api/v1/auth/register", { method: "POST", body: JSON.stringify({ name, email, password }) });
        setSession(body.user);
        await refresh();
        router.push("/");
      } catch {
        setError("N/A");
      }
    }}>
      <h1 className="text-xl font-semibold">{t("register")}</h1>
      <label className="block text-xs text-muted">{t("yourName")}<Input value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="block text-xs text-muted">{t("email")}<Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label className="block text-xs text-muted">{t("password")}<Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      {error && <p className="text-sm text-down">{error}</p>}
      <Button type="submit">{t("register")}</Button>
    </form>
  );
}
