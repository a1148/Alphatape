"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type ColumnDef, type SortingState } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import * as Switch from "@radix-ui/react-switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { consensusTone, formatCompact, formatPct, formatPrice, scoreColor } from "@/lib/format";
import { useI18n, type MsgKey } from "@/lib/i18n";
import { useApp } from "@/lib/state";
import type { StockRow } from "@alphatape/shared";

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted">
      <Switch.Root checked={checked} onCheckedChange={onChange} className="relative h-5 w-9 rounded-full border border-line bg-panel-2 data-[state=checked]:bg-accent">
        <Switch.Thumb className="block size-4 translate-x-0.5 rounded-full bg-white transition rtl:translate-x-0 data-[state=checked]:translate-x-4 rtl:data-[state=checked]:-translate-x-4" />
      </Switch.Root>
      {label}
    </label>
  );
}

export function Scanner() {
  const { t, locale } = useI18n();
  const { rows, loading, error, refresh } = useApp();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get("q") ?? "");
  useEffect(() => { setQ(params.get("q") ?? ""); }, [params]);
  const [strong, setStrong] = useState(false);
  const [breakout, setBreakout] = useState(false);
  const [minUpside, setMinUpside] = useState("");
  const [minCap, setMinCap] = useState("");
  const [maxCap, setMaxCap] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [rsiMin, setRsiMin] = useState("");
  const [rsiMax, setRsiMax] = useState("");
  const [minAnalysts, setMinAnalysts] = useState("");
  const [minConfidence, setMinConfidence] = useState("");
  const [sector, setSector] = useState("");
  const [theme, setTheme] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "score", desc: true }]);
  const parentRef = useRef<HTMLDivElement>(null);

  const sectors = useMemo(() => [...new Set((rows ?? []).map((row) => row.sector))].sort(), [rows]);
  const themes = ["ai", "semiconductors", "cybersecurity", "cloud", "quantum", "biotech", "infrastructure", "small_cap", "momentum"] as const;

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (rows ?? []).filter((row) => {
      if (query && !`${row.symbol} ${row.name} ${row.nameHe ?? ""}`.toLowerCase().includes(query)) return false;
      if (strong && row.consensus.value !== "strong_buy") return false;
      if (breakout && row.breakout.status !== "breakout" && row.breakout.status !== "pre_breakout") return false;
      if (minUpside && (row.upside.value == null || row.upside.value < Number(minUpside))) return false;
      if (minCap && (row.marketCap.value == null || row.marketCap.value < Number(minCap) * 1e9)) return false;
      if (maxCap && (row.marketCap.value == null || row.marketCap.value > Number(maxCap) * 1e9)) return false;
      if (minPrice && (row.price.value == null || row.price.value < Number(minPrice))) return false;
      if (maxPrice && (row.price.value == null || row.price.value > Number(maxPrice))) return false;
      if (rsiMin && (row.rsi14.value == null || row.rsi14.value < Number(rsiMin))) return false;
      if (rsiMax && (row.rsi14.value == null || row.rsi14.value > Number(rsiMax))) return false;
      if (minAnalysts && (row.analystCount.value == null || row.analystCount.value < Number(minAnalysts))) return false;
      if (minConfidence && (row.score.confidence == null || row.score.confidence < Number(minConfidence))) return false;
      if (sector && row.sector !== sector) return false;
      if (theme && !row.themes.some((item) => item.id === theme)) return false;
      return true;
    });
  }, [rows, q, strong, breakout, minUpside, minCap, maxCap, minPrice, maxPrice, rsiMin, rsiMax, minAnalysts, minConfidence, sector, theme]);

  const columns = useMemo<ColumnDef<StockRow>[]>(() => [
    { id: "symbol", accessorFn: (row) => row.symbol, header: t("symbol"), cell: ({ row }) => <button className="font-mono text-info" onClick={() => router.push(`/stock/${row.original.symbol}`)}>{row.original.symbol}</button> },
    { id: "name", accessorFn: (row) => (locale === "he" ? row.nameHe ?? row.name : row.name), header: t("name"), cell: ({ row }) => <span className="max-w-[180px] truncate">{locale === "he" ? row.original.nameHe ?? row.original.name : row.original.name}</span> },
    { id: "price", accessorFn: (row) => row.price.value ?? -1, header: t("last"), cell: ({ row }) => <span className="num">{formatPrice(row.original.price.value, row.original.currency, locale)}</span> },
    { id: "day", accessorFn: (row) => row.changePercent.value ?? -999, header: t("day"), cell: ({ row }) => <span className={`num ${((row.original.changePercent.value ?? 0) >= 0) ? "text-up" : "text-down"}`}>{formatPct(row.original.changePercent.value, locale)}</span> },
    { id: "mcap", accessorFn: (row) => row.marketCap.value ?? -1, header: t("mcap"), cell: ({ row }) => <span className="num">{formatCompact(row.original.marketCap.value, row.original.currency, locale)}</span> },
    { id: "score", accessorFn: (row) => row.score.score ?? -1, header: t("score"), cell: ({ row }) => <span className="num font-semibold" style={{ color: scoreColor(row.original.score.score) }}>{row.original.score.score ?? "N/A"}</span> },
    { id: "consensus", accessorFn: (row) => row.consensus.value ?? "", header: t("consensus"), cell: ({ row }) => <Badge className={consensusTone(row.original.consensus.value)}>{row.original.consensus.value ? t(row.original.consensus.value as MsgKey) : "N/A"}</Badge> },
    { id: "upside", accessorFn: (row) => row.upside.value ?? -999, header: t("upside"), cell: ({ row }) => <span className="num">{formatPct(row.original.upside.value, locale)}</span> },
    { id: "rsi", accessorFn: (row) => row.rsi14.value ?? -1, header: "RSI", cell: ({ row }) => <span className="num">{row.original.rsi14.value == null ? "N/A" : row.original.rsi14.value.toFixed(0)}</span> },
    { id: "theme", accessorFn: (row) => row.themes[0]?.id ?? "", header: t("themes"), cell: ({ row }) => <span className="text-[11px] text-muted">{row.original.themes.slice(0, 2).map((item) => t(item.id as MsgKey)).join(" · ") || "N/A"}</span> },
  ], [locale, router, t]);

  const table = useReactTable({ data: filtered, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() });
  const tableRows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({ count: tableRows.length, getScrollElement: () => parentRef.current, estimateSize: () => 42, overscan: 12 });

  const strongCount = (rows ?? []).filter((row) => row.consensus.value === "strong_buy").length;
  const breakoutCount = (rows ?? []).filter((row) => row.breakout.status === "breakout" || row.breakout.status === "pre_breakout").length;

  if (loading && !rows) return <div className="panel p-8 text-sm text-muted">{t("loading")}</div>;
  if (error && !rows) return <div className="panel p-8 text-sm"><p>{t("error")}</p><Button className="mt-3" onClick={() => void refresh()}>{t("retry")}</Button></div>;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[{ k: t("universe"), v: String(rows?.length ?? 0) }, { k: t("strongBuys"), v: String(strongCount) }, { k: t("breakouts"), v: String(breakoutCount) }, { k: t("modelEstimate"), v: "v1" }].map((card) => (
          <div key={card.k} className="panel px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-muted">{card.k}</div>
            <div className="num text-lg">{card.v}</div>
          </div>
        ))}
      </div>
      <div className="panel space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input className="max-w-xs md:hidden" value={q} onChange={(event) => setQ(event.target.value)} placeholder={t("search")} />
          <Toggle label={t("strongBuy")} checked={strong} onChange={setStrong} />
          <Toggle label={t("breakoutOnly")} checked={breakout} onChange={setBreakout} />
          <Button variant="ghost" size="sm" onClick={() => { setQ(""); setStrong(false); setBreakout(false); setMinUpside(""); setMinCap(""); setMaxCap(""); setMinPrice(""); setMaxPrice(""); setRsiMin(""); setRsiMax(""); setMinAnalysts(""); setMinConfidence(""); setSector(""); setTheme(""); }}>{t("clear")}</Button>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <Input inputMode="decimal" placeholder={`${t("minUpside")} %`} value={minUpside} onChange={(e) => setMinUpside(e.target.value)} />
          <Input inputMode="decimal" placeholder={`${t("mcap")} min $B`} value={minCap} onChange={(e) => setMinCap(e.target.value)} />
          <Input inputMode="decimal" placeholder={`${t("mcap")} max $B`} value={maxCap} onChange={(e) => setMaxCap(e.target.value)} />
          <Input inputMode="decimal" placeholder="RSI min" value={rsiMin} onChange={(e) => setRsiMin(e.target.value)} />
          <Input inputMode="decimal" placeholder="RSI max" value={rsiMax} onChange={(e) => setRsiMax(e.target.value)} />
          <Input inputMode="decimal" placeholder={t("minAnalysts")} value={minAnalysts} onChange={(e) => setMinAnalysts(e.target.value)} />
          <Input inputMode="decimal" placeholder={t("minConfidence")} value={minConfidence} onChange={(e) => setMinConfidence(e.target.value)} />
          <Input inputMode="decimal" placeholder={`${t("priceRange")} min`} value={minPrice} onChange={(e) => setMinPrice(e.target.value)} />
          <Input inputMode="decimal" placeholder={`${t("priceRange")} max`} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} />
          <select className="h-9 rounded-md border border-line bg-panel-2 px-2 text-sm" value={sector} onChange={(e) => setSector(e.target.value)} aria-label={t("sector")}>
            <option value="">{t("sector")}</option>
            {sectors.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="h-9 rounded-md border border-line bg-panel-2 px-2 text-sm" value={theme} onChange={(e) => setTheme(e.target.value)} aria-label={t("theme")}>
            <option value="">{t("theme")}</option>
            {themes.map((item) => <option key={item} value={item}>{t(item)}</option>)}
          </select>
        </div>
      </div>
      <div className="panel hidden overflow-hidden md:block">
        <div ref={parentRef} className="h-[calc(100vh-320px)] min-h-[420px] overflow-auto text-xs">
          {table.getHeaderGroups().map((group) => (
            <div key={group.id} className="sticky top-0 z-10 grid grid-cols-10 bg-panel-2 text-muted">
              {group.headers.map((header) => (
                <button key={header.id} className="px-2 py-2 text-start font-medium" onClick={header.column.getToggleSortingHandler()}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {{ asc: " ↑", desc: " ↓" }[header.column.getIsSorted() as string] ?? ""}
                </button>
              ))}
            </div>
          ))}
          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtual) => {
              const row = tableRows[virtual.index];
              return (
                <div key={row.id} className="absolute inset-x-0 grid grid-cols-10 border-t border-line/70 hover:bg-white/[0.03]" style={{ transform: `translateY(${virtual.start}px)`, height: 42 }} onClick={() => router.push(`/stock/${row.original.symbol}`)}>
                  {row.getVisibleCells().map((cell) => <div key={cell.id} className="flex items-center px-2">{flexRender(cell.column.columnDef.cell, cell.getContext())}</div>)}
                </div>
              );
            })}
          </div>
          {!tableRows.length && <div className="p-8 text-center text-sm text-muted">{t("noResults")}</div>}
        </div>
      </div>
      <div className="grid gap-2 md:hidden">
        {filtered.length === 0 && <div className="panel p-6 text-center text-sm text-muted">{t("noResults")}</div>}
        {filtered.map((row) => (
          <button key={row.symbol} className="panel p-3 text-start" onClick={() => router.push(`/stock/${row.symbol}`)}>
            <div className="flex items-center justify-between gap-2">
              <div><div className="font-mono text-info">{row.symbol}</div><div className="text-xs text-muted">{locale === "he" ? row.nameHe ?? row.name : row.name}</div></div>
              <div className="text-end"><div className="num">{formatPrice(row.price.value, row.currency, locale)}</div><div className={`num text-xs ${((row.changePercent.value ?? 0) >= 0) ? "text-up" : "text-down"}`}>{formatPct(row.changePercent.value, locale)}</div></div>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="num font-semibold" style={{ color: scoreColor(row.score.score) }}>{t("score")} {row.score.score ?? "N/A"}</span>
              <Badge className={consensusTone(row.consensus.value)}>{row.consensus.value ? t(row.consensus.value as MsgKey) : "N/A"}</Badge>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
