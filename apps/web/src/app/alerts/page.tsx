"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useI18n, type MsgKey } from "@/lib/i18n";
import { useApp } from "@/lib/state";

interface Alert { id: string; symbol: string; kind: string; threshold: number; enabled: boolean }

const kinds = ["price_above", "price_below", "score_above", "score_below", "change_pct_above"] as const;

export default function AlertsPage() {
  const { user, rows } = useApp();
  const { t } = useI18n();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [symbol, setSymbol] = useState("NVDA");
  const [kind, setKind] = useState<(typeof kinds)[number]>("price_above");
  const [threshold, setThreshold] = useState("100");
  const load = () => api<{ alerts: Alert[] }>("/api/v1/alerts").then((body) => setAlerts(body.alerts));
  useEffect(() => { if (user) void load(); }, [user]);
  if (!user) return <div className="panel p-8 text-sm">{t("loginRequired")} <Link className="text-info" href="/login">{t("login")}</Link></div>;
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("navAlerts")}</h1>
      <form className="panel grid gap-2 p-3 md:grid-cols-4" onSubmit={async (event) => { event.preventDefault(); await api("/api/v1/alerts", { method: "POST", body: JSON.stringify({ symbol, kind, threshold: Number(threshold) }) }); await load(); }}>
        <select className="h-9 rounded-md border border-line bg-panel-2 px-2 text-sm" value={symbol} onChange={(e) => setSymbol(e.target.value)}>{(rows ?? []).map((row) => <option key={row.symbol}>{row.symbol}</option>)}</select>
        <select className="h-9 rounded-md border border-line bg-panel-2 px-2 text-sm" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>{kinds.map((item) => <option key={item} value={item}>{t(item as MsgKey)}</option>)}</select>
        <Input value={threshold} onChange={(e) => setThreshold(e.target.value)} />
        <Button type="submit">{t("createAlert")}</Button>
      </form>
      {!alerts.length && <div className="text-sm text-muted">{t("alertsEmpty")}</div>}
      <ul className="space-y-2">
        {alerts.map((alert) => (
          <li key={alert.id} className="panel flex items-center justify-between p-3 text-sm">
            <span className="font-mono text-info">{alert.symbol}</span>
            <span>{t(alert.kind as MsgKey)} · {alert.threshold}</span>
            <Button variant="ghost" size="sm" onClick={async () => { await api(`/api/v1/alerts/${alert.id}`, { method: "DELETE" }); await load(); }}>{t("unwatch")}</Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
