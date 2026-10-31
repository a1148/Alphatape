"use client";

import Link from "next/link";
import { formatPct, formatPrice, scoreColor } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApp } from "@/lib/state";

export default function WatchlistPage() {
  const { rows, user, watched } = useApp();
  const { t, locale } = useI18n();
  if (!user) return <div className="panel p-8 text-sm">{t("loginRequired")} <Link className="text-info" href="/login">{t("login")}</Link></div>;
  const items = (rows ?? []).filter((row) => watched.has(row.symbol));
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">{t("navWatchlist")}</h1>
      {!items.length && <div className="panel p-8 text-sm text-muted">{t("watchEmpty")}</div>}
      <div className="grid gap-2">
        {items.map((row) => (
          <Link key={row.symbol} href={`/stock/${row.symbol}`} className="panel flex items-center justify-between p-3">
            <span><span className="font-mono text-info">{row.symbol}</span> <span className="text-sm text-muted">{locale === "he" ? row.nameHe ?? row.name : row.name}</span></span>
            <span className="num">{formatPrice(row.price.value, row.currency, locale)}</span>
            <span className={`num ${(row.changePercent.value ?? 0) >= 0 ? "text-up" : "text-down"}`}>{formatPct(row.changePercent.value, locale)}</span>
            <span className="num" style={{ color: scoreColor(row.score.score) }}>{row.score.score ?? "N/A"}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
