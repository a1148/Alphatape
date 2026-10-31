"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { formatPct } from "@/lib/format";
import { useI18n } from "@/lib/i18n";
import { useApp } from "@/lib/state";

function color(change: number | null) {
  if (change == null) return "#243140";
  const clamped = Math.max(-4, Math.min(4, change));
  const t = (clamped + 4) / 8;
  const r = Math.round(255 * (1 - t) + 31 * t);
  const g = Math.round(80 * (1 - t) + 214 * t);
  const b = Math.round(100 * (1 - t) + 138 * t);
  return `rgb(${r}, ${g}, ${b})`;
}

export default function HeatmapPage() {
  const { rows } = useApp();
  const { t, locale } = useI18n();
  const tv = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = tv.current;
    if (!node) return;
    node.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-stock-heatmap.js";
    script.async = true;
    script.innerHTML = JSON.stringify({ exchanges: [], dataSource: "SPX500", grouping: "sector", blockSize: "market_cap_basic", blockColor: "change", locale: locale === "he" ? "he_IL" : "en", colorTheme: "dark", hasTopBar: false, isDataSetEnabled: false, width: "100%", height: 420 });
    node.append(script);
  }, [locale]);
  const max = Math.max(...(rows ?? []).map((row) => Math.sqrt(row.marketCap.value ?? 1)), 1);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">{t("navHeatmap")}</h1>
      <div className="panel flex min-h-[420px] flex-wrap content-start gap-1 p-2">
        {(rows ?? []).map((row) => (
          <Link key={row.symbol} href={`/stock/${row.symbol}`} className="flex min-h-16 min-w-16 flex-col justify-between rounded p-2 text-black" style={{ background: color(row.changePercent.value), flexGrow: Math.max(1, Math.sqrt(row.marketCap.value ?? 1) / max * 12), flexBasis: 90 }}>
            <span className="font-mono text-xs font-semibold">{row.symbol}</span>
            <span className="num text-xs">{formatPct(row.changePercent.value, locale)}</span>
          </Link>
        ))}
      </div>
      <section>
        <h2 className="mb-2 text-sm text-muted">{t("heatmapExternal")}</h2>
        <div ref={tv} className="panel h-[440px] overflow-hidden" />
      </section>
    </div>
  );
}
