"use client";

import { useMemo, useState } from "react";
import { formatNumber, formatPct, formatPrice, scoreColor } from "@/lib/format";
import { useI18n, type MsgKey } from "@/lib/i18n";
import { useApp } from "@/lib/state";

export default function ComparePage() {
  const { rows } = useApp();
  const { t, locale } = useI18n();
  const [picked, setPicked] = useState<string[]>([]);
  const symbols = rows?.map((row) => row.symbol) ?? [];
  const selected = useMemo(() => picked.map((symbol) => rows?.find((row) => row.symbol === symbol)).filter(Boolean), [picked, rows]);
  const mixed = new Set(selected.map((row) => row!.currency)).size > 1;
  const lines: Array<{ label: string; cell: (row: NonNullable<(typeof selected)[number]>) => string }> = [
    { label: t("last"), cell: (row) => formatPrice(row.price.value, row.currency, locale) },
    { label: t("day"), cell: (row) => formatPct(row.changePercent.value, locale) },
    { label: t("score"), cell: (row) => row.score.score == null ? "N/A" : String(row.score.score) },
    { label: t("confidence"), cell: (row) => row.score.confidence == null ? "N/A" : String(row.score.confidence) },
    { label: t("consensus"), cell: (row) => row.consensus.value ? t(row.consensus.value as MsgKey) : "N/A" },
    { label: t("upside"), cell: (row) => formatPct(row.upside.value, locale) },
    { label: t("pe"), cell: (row) => formatNumber(row.pe.value, locale, 1) },
    { label: t("rev"), cell: (row) => formatPct(row.revenueGrowth.value, locale, 1) },
    { label: "RSI", cell: (row) => row.rsi14.value == null ? "N/A" : formatNumber(row.rsi14.value, locale, 0) },
    { label: t("risk"), cell: (row) => row.score.risk.rating ? t(row.score.risk.rating) : "N/A" },
  ];
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">{t("navCompare")}</h1>
      <p className="text-xs text-muted">{t("compareHint")}</p>
      <div className="flex flex-wrap gap-2">
        {symbols.map((symbol) => {
          const on = picked.includes(symbol);
          return <button key={symbol} className={`rounded border px-2 py-1 font-mono text-xs ${on ? "border-accent text-accent" : "border-line text-muted"}`} onClick={() => setPicked((current) => on ? current.filter((item) => item !== symbol) : current.length >= 4 ? current : [...current, symbol])}>{symbol}</button>;
        })}
      </div>
      {mixed && <p className="text-xs text-accent">{t("mixedFx")}</p>}
      {selected.length >= 2 ? (
        <div className="panel overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="p-2 text-start text-muted"> </th>
                {selected.map((row) => <th key={row!.symbol} className="p-2 text-start font-mono text-info">{row!.symbol}</th>)}
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.label} className="border-t border-line">
                  <th className="p-2 text-start text-xs font-normal text-muted">{line.label}</th>
                  {selected.map((row) => (
                    <td key={row!.symbol} className="num p-2" style={line.label === t("score") ? { color: scoreColor(row!.score.score) } : undefined}>{line.cell(row!)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
