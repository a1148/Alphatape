"use client";

import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import { formatPct, formatPrice, scoreColor } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApp } from "@/lib/state";
import type { StockRow } from "@alphatape/shared";

function List({ rows, locale }: { rows: StockRow[]; locale: "he" | "en" }) {
  return (
    <ol className="divide-y divide-line">
      {rows.map((row, index) => (
        <li key={row.symbol}>
          <Link href={`/stock/${row.symbol}`} className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-white/5">
            <span className="num text-muted">{index + 1}</span>
            <span className="font-mono text-info">{row.symbol}</span>
            <span className="flex-1 truncate text-sm">{locale === "he" ? row.nameHe ?? row.name : row.name}</span>
            <span className="num text-sm">{formatPrice(row.price.value, row.currency, locale)}</span>
            <span className={`num text-sm ${(row.changePercent.value ?? 0) >= 0 ? "text-up" : "text-down"}`}>{formatPct(row.changePercent.value, locale)}</span>
            <span className="num text-sm" style={{ color: scoreColor(row.score.score) }}>{row.score.score ?? "N/A"}</span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

export default function MoversPage() {
  const { rows } = useApp();
  const { t, locale } = useI18n();
  const data = rows ?? [];
  const byChange = [...data].filter((row) => row.changePercent.value != null).sort((a, b) => (b.changePercent.value ?? 0) - (a.changePercent.value ?? 0));
  const gainers = byChange.slice(0, 15);
  const losers = [...byChange].reverse().slice(0, 15);
  const volume = [...data].filter((row) => row.volume.value != null).sort((a, b) => (b.volume.value ?? 0) - (a.volume.value ?? 0)).slice(0, 15);
  const trending = [...data].sort((a, b) => ((b.changePercent.value ?? 0) * Math.log10((b.volume.value ?? 0) + 10) + (b.score.score ?? 0) / 20) - ((a.changePercent.value ?? 0) * Math.log10((a.volume.value ?? 0) + 10) + (a.score.score ?? 0) / 20)).slice(0, 15);
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">{t("navMovers")}</h1>
      <p className="text-xs text-muted">{t("trendingFormula")}</p>
      <Tabs.Root defaultValue="gainers" className="panel">
        <Tabs.List className="flex gap-2 border-b border-line px-3 py-2 text-sm">
          <Tabs.Trigger value="gainers" className="rounded px-2 py-1 data-[state=active]:bg-white/10">{t("gainers")}</Tabs.Trigger>
          <Tabs.Trigger value="losers" className="rounded px-2 py-1 data-[state=active]:bg-white/10">{t("losers")}</Tabs.Trigger>
          <Tabs.Trigger value="volume" className="rounded px-2 py-1 data-[state=active]:bg-white/10">{t("topVolume")}</Tabs.Trigger>
          <Tabs.Trigger value="trending" className="rounded px-2 py-1 data-[state=active]:bg-white/10">{t("trending")}</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="gainers"><List rows={gainers} locale={locale} /></Tabs.Content>
        <Tabs.Content value="losers"><List rows={losers} locale={locale} /></Tabs.Content>
        <Tabs.Content value="volume"><List rows={volume} locale={locale} /></Tabs.Content>
        <Tabs.Content value="trending"><List rows={trending} locale={locale} /></Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
