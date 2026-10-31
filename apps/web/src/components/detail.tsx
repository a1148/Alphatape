"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as Tabs from "@radix-ui/react-tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PriceChart, type ChartBar } from "@/components/chart";
import { api } from "@/lib/api";
import { consensusTone, formatCompact, formatNumber, formatPct, formatPrice, formatWhen, scoreColor } from "@/lib/format";
import { useI18n, type MsgKey } from "@/lib/i18n";
import { useApp } from "@/lib/state";
import { tvSymbol } from "@/lib/utils";
import type { Sourced, StockRow } from "@alphatape/shared";

function Field({ label, value, sourced, locale }: { label: string; value: string; sourced?: Sourced<unknown>; locale: "he" | "en" }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className="num mt-1 text-base">{value}</div>
      <div className="mt-1 text-[10px] text-muted">{sourced?.source ?? "N/A"} · {formatWhen(sourced?.asOf, locale)}</div>
    </div>
  );
}

export function StockDetail({ symbol }: { symbol: string }) {
  const { t, locale } = useI18n();
  const { rows, user, watched, toggleWatch } = useApp();
  const [fetched, setFetched] = useState<StockRow | null>(null);
  const inList = rows?.find((item) => item.symbol.toUpperCase() === symbol.toUpperCase()) ?? null;
  const row = inList ?? fetched;
  const [bars, setBars] = useState<ChartBar[]>([]);
  const [barMeta, setBarMeta] = useState<{ source: string | null; demo: boolean }>({ source: null, demo: false });
  const [news, setNews] = useState<Array<{ id: string; headline: string; summary: string | null; url: string | null; sourceName: string; provider: string; publishedAt: string; isDemo: boolean }>>([]);
  const [ai, setAi] = useState<null | { enabled: false; reason: string } | { enabled: true; summary: string; why: string; risk: string; bull: string; bear: string; outlook3m: string; outlook1y: string; model: string; cached: boolean }>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (!rows || inList) return;
    let cancelled = false;
    void api<{ row: StockRow }>(`/api/v1/stocks/${symbol}`).then((body) => {
      if (!cancelled) setFetched(body.row);
    }).catch(() => {
      if (!cancelled) setFetched(null);
    });
    return () => { cancelled = true; };
  }, [rows, inList, symbol]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [barBody, newsBody] = await Promise.all([
        api<{ bars: ChartBar[]; source: string | null; demo: boolean }>(`/api/v1/stocks/${symbol}/bars`),
        api<{ items: typeof news }>(`/api/v1/stocks/${symbol}/news`),
      ]);
      if (cancelled) return;
      setBars(barBody.bars);
      setBarMeta({ source: barBody.source, demo: barBody.demo });
      setNews(newsBody.items);
    })();
    return () => { cancelled = true; };
  }, [symbol]);

  if (!row) return <div className="panel p-8 text-sm text-muted">{rows ? t("noResults") : t("loading")}</div>;
  const name = locale === "he" ? row.nameHe ?? row.name : row.name;
  const breakoutLabel = row.breakout.status === "breakout" ? t("breakout") : row.breakout.status === "pre_breakout" ? t("preBreakout") : row.breakout.status === "insufficient_data" ? t("insufficient") : t("none");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/" className="text-xs text-muted">{t("navScanner")}</Link>
          <h1 className="mt-1 text-2xl font-semibold">{name} <span className="font-mono text-info">{row.symbol}</span></h1>
          <div className="mt-1 text-xs text-muted">{row.exchange} · {row.sector} · {row.industry}</div>
          <p className="mt-2 max-w-3xl text-sm text-muted">{row.description}</p>
        </div>
        <div className="text-end">
          <div className="num text-3xl">{formatPrice(row.price.value, row.currency, locale)}</div>
          <div className={`num ${((row.changePercent.value ?? 0) >= 0) ? "text-up" : "text-down"}`}>{formatPct(row.changePercent.value, locale)}</div>
          <div className="text-[10px] text-muted">{row.price.source ?? "N/A"} · {formatWhen(row.price.asOf, locale)}</div>
          <Button className="mt-2" variant={watched.has(row.symbol) ? "danger" : "outline"} size="sm" onClick={() => user ? void toggleWatch(row.symbol) : location.assign("/login")}>{watched.has(row.symbol) ? t("unwatch") : t("watch")}</Button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {row.themes.map((theme) => <Badge key={theme.id + theme.origin} className="bg-white/5 text-ink">{t(theme.id as MsgKey)}{theme.modelEstimate ? ` · ${t("llmTag")}` : ""}</Badge>)}
        <Badge className={consensusTone(row.consensus.value)}>{row.consensus.value ? t(row.consensus.value as MsgKey) : "N/A"}</Badge>
        <Badge className="bg-info/10 text-info">{breakoutLabel}</Badge>
      </div>
      <div className="grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <div className="panel p-3">
          <Tabs.Root defaultValue="tape">
            <Tabs.List className="mb-2 flex gap-2 text-xs">
              <Tabs.Trigger value="tape" className="rounded px-2 py-1 data-[state=active]:bg-white/10">{t("chart")}</Tabs.Trigger>
              <Tabs.Trigger value="tv" className="rounded px-2 py-1 data-[state=active]:bg-white/10">TradingView</Tabs.Trigger>
            </Tabs.List>
            <Tabs.Content value="tape">
              <div className="mb-2 text-[11px] text-muted">{barMeta.demo ? t("demoChart") : t("chart")} · {barMeta.source ?? "N/A"}</div>
              {bars.length ? <PriceChart bars={bars} /> : <div className="grid h-[360px] place-items-center text-sm text-muted">N/A</div>}
            </Tabs.Content>
            <Tabs.Content value="tv">
              <p className="mb-2 text-[11px] text-muted">{t("externalChart")}</p>
              <TvWidget symbol={tvSymbol(row.symbol, row.exchange)} locale={locale} />
            </Tabs.Content>
          </Tabs.Root>
        </div>
        <div className="panel p-4">
          <div className="text-[11px] uppercase tracking-wide text-muted">{t("score")}</div>
          <div className="num text-5xl font-semibold" style={{ color: scoreColor(row.score.score) }}>{row.score.score ?? "N/A"}</div>
          <div className="text-xs text-muted">{t("confidence")} {row.score.confidence ?? "N/A"} · {t("modelEstimate")}</div>
          <div className="mt-1 text-xs">{t("risk")}: {row.score.risk.rating ? t(row.score.risk.rating) : "N/A"}</div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted">{row.score.note}</p>
          <div className="mt-3 space-y-2">
            {row.score.components.map((part) => (
              <div key={part.key}>
                <div className="flex justify-between text-[11px]"><span>{part.label}</span><span className="num">{part.score ?? "N/A"}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-white/5"><div className="h-full bg-accent" style={{ width: `${part.score ?? 0}%` }} /></div>
                <div className="text-[10px] text-muted">{part.score == null ? t("excluded") : part.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Field label={t("mcap")} value={formatCompact(row.marketCap.value, row.currency, locale)} sourced={row.marketCap} locale={locale} />
        <Field label={t("pe")} value={formatNumber(row.pe.value, locale, 1)} sourced={row.pe} locale={locale} />
        <Field label={t("rev")} value={formatPct(row.revenueGrowth.value, locale, 1)} sourced={row.revenueGrowth} locale={locale} />
        <Field label={t("eps")} value={formatPct(row.epsGrowth.value, locale, 1)} sourced={row.epsGrowth} locale={locale} />
        <Field label={t("short")} value={row.shortInterest.value == null ? "N/A" : `${formatNumber(row.shortInterest.value, locale, 1)}%`} sourced={row.shortInterest} locale={locale} />
        <Field label={t("inst")} value={row.institutionalOwnership.value == null ? "N/A" : `${formatNumber(row.institutionalOwnership.value, locale, 1)}%`} sourced={row.institutionalOwnership} locale={locale} />
        <Field label={t("insider")} value={formatCompact(row.insiderNetValue.value, row.currency, locale)} sourced={row.insiderNetValue} locale={locale} />
        <Field label={t("buys")} value={`${row.strongBuy.value ?? "N/A"} / ${row.buy.value ?? "N/A"}`} sourced={row.strongBuy} locale={locale} />
        <Field label={t("target")} value={formatPrice(row.targetMean.value, row.currency, locale)} sourced={row.targetMean} locale={locale} />
        <Field label={t("upside")} value={formatPct(row.upside.value, locale)} sourced={row.upside} locale={locale} />
        <Field label="RSI(14)" value={row.rsi14.value == null ? "N/A" : formatNumber(row.rsi14.value, locale, 1)} sourced={row.rsi14} locale={locale} />
        <Field label={t("macd")} value={row.macdHist.value == null ? "N/A" : formatNumber(row.macdHist.value, locale, 3)} sourced={row.macdHist} locale={locale} />
        <Field label={t("sma")} value={`${row.sma50.value == null ? "N/A" : formatNumber(row.sma50.value, locale, 2)} / ${row.sma200.value == null ? "N/A" : formatNumber(row.sma200.value, locale, 2)}`} sourced={row.sma50} locale={locale} />
        <Field label={t("volume")} value={row.volume.value == null ? "N/A" : formatCompact(row.volume.value, row.currency, locale).replace(/[₪$]/g, "")} sourced={row.volume} locale={locale} />
        <Field label={t("analysts")} value={row.analystCount.value == null ? "N/A" : String(row.analystCount.value)} sourced={row.analystCount} locale={locale} />
        <Field label={t("breakout")} value={breakoutLabel} locale={locale} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="panel p-4">
          <h2 className="text-sm font-semibold">{t("news")}</h2>
          <ul className="mt-3 space-y-3">
            {news.length === 0 && <li className="text-sm text-muted">N/A</li>}
            {news.map((item) => (
              <li key={item.id}>
                <div className="text-sm">{item.url ? <a className="text-info hover:underline" href={item.url} target="_blank" rel="noreferrer">{item.headline}</a> : item.headline}</div>
                <div className="text-[11px] text-muted">{item.sourceName} · {item.provider}{item.isDemo ? " · DEMO" : ""} · {formatWhen(item.publishedAt, locale)}</div>
              </li>
            ))}
          </ul>
        </section>
        <section className="panel p-4">
          <h2 className="text-sm font-semibold">{t("aiTitle")}</h2>
          <p className="mt-1 text-[11px] text-accent">{t("modelEstimate")}</p>
          {!ai && <Button className="mt-3" onClick={async () => {
            setAiError(null);
            try { setAi(await api(`/api/v1/stocks/${row.symbol}/ai`, { method: "POST", body: JSON.stringify({ locale }) })); }
            catch (err) { setAiError(err instanceof Error ? err.message : "error"); }
          }}>{t("generate")}</Button>}
          {aiError && <p className="mt-2 text-sm text-down">{aiError}</p>}
          {ai && !ai.enabled && <p className="mt-3 text-sm text-muted">{t("aiDisabled")}</p>}
          {ai && ai.enabled && (
            <div className="mt-3 space-y-2 text-sm leading-relaxed">
              <p>{ai.summary}</p>
              <p><span className="text-muted">{t("why")}: </span>{ai.why}</p>
              <p><span className="text-muted">{t("riskNote")}: </span>{ai.risk}</p>
              <p><span className="text-up">{t("bull")}: </span>{ai.bull}</p>
              <p><span className="text-down">{t("bear")}: </span>{ai.bear}</p>
              <p><span className="text-muted">{t("outlook3")}: </span>{ai.outlook3m}</p>
              <p><span className="text-muted">{t("outlook1")}: </span>{ai.outlook1y}</p>
              <p className="text-[11px] text-muted">{ai.model}{ai.cached ? " · cache" : ""}</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function TvWidget({ symbol, locale }: { symbol: string; locale: "he" | "en" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    node.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "tradingview-widget-container";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({ autosize: true, symbol, interval: "D", timezone: "Asia/Jerusalem", theme: "dark", style: "1", locale: locale === "he" ? "he_IL" : "en", hide_top_toolbar: false, allow_symbol_change: false, support_host: "https://www.tradingview.com" });
    wrap.append(widget, script);
    node.append(wrap);
  }, [symbol, locale]);
  return <div ref={ref} className="h-[420px]" />;
}
