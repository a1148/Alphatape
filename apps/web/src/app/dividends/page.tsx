"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { formatNumber, formatPct, formatPrice, scoreColor } from "@/lib/format";
import { useI18n, type MsgKey } from "@/lib/i18n";
import type { Sourced } from "@alphatape/shared";

interface Stability {
  modelEstimate: true;
  score: number | null;
  confidence: number | null;
  renormalized: boolean;
  note: string;
  components: Array<{ key: string; score: number | null; weight: number; detail: string }>;
}

interface BoardRow {
  symbol: string;
  name: string;
  nameHe: string | null;
  currency: string;
  sector: string;
  price: Sourced<number>;
  marketCap: Sourced<number>;
  pe: Sourced<number>;
  risk: { rating: string | null };
  beta: Sourced<number>;
  debtToEquity: Sourced<number>;
  interestCoverage: Sourced<number>;
  yieldPct: Sourced<number>;
  consecutiveYears: Sourced<number>;
  dividendCagr5Pct: Sourced<number>;
  priceCagr5Pct: Sourced<number>;
  priceCagr10Pct: Sourced<number>;
  payoutPct: Sourced<number>;
  stability: Stability;
}

interface Screen {
  demoMode: boolean;
  disclaimer: { en: string; he: string };
  gates: { minConsecutiveYears: number; minPriceCagr5Pct: number; minPriceCagr10Pct: number };
  screened: number;
  passed: number;
  board: BoardRow[];
  rejected: Array<{ symbol: string; name: string; passes: boolean; failReasons: string[]; stability: number | null }>;
}

function num(value: number | null | undefined, locale: "he" | "en", digits = 1) {
  return formatNumber(value, locale, digits);
}

export default function DividendPage() {
  const { t, locale } = useI18n();
  const [screen, setScreen] = useState<Screen | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    api<Screen>("/api/v1/dividends").then(setScreen).catch((err) => setError(err instanceof Error ? err.message : "error"));
  }, []);
  if (error) return <div className="panel p-8 text-sm">{t("error")}</div>;
  if (!screen) return <div className="panel p-8 text-sm text-muted">{t("loading")}</div>;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("navDividend")}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted">{t("dividendIntro")}</p>
        <p className="mt-2 text-xs text-accent">{locale === "he" ? screen.disclaimer.he : screen.disclaimer.en}</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="panel px-3 py-2"><div className="text-[11px] text-muted">{t("screened")}</div><div className="num text-lg">{screen.screened}</div></div>
        <div className="panel px-3 py-2"><div className="text-[11px] text-muted">{t("passed")}</div><div className="num text-lg">{screen.passed}</div></div>
        <div className="panel px-3 py-2"><div className="text-[11px] text-muted">{t("navDividend")}</div><div className="num text-lg">{screen.board.length}</div></div>
      </div>
      <div className="space-y-2">
        {screen.board.map((row) => (
          <article key={row.symbol} className="panel p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link href={`/stock/${row.symbol}`} className="font-mono text-info">{row.symbol}</Link>
                <div className="text-sm">{locale === "he" ? row.nameHe ?? row.name : row.name}</div>
                <div className="text-[11px] text-muted">{row.sector} · {row.risk.rating ? t(row.risk.rating as MsgKey) : "N/A"}</div>
              </div>
              <div className="text-end">
                <div className="num text-xl" style={{ color: scoreColor(row.stability.score) }}>{row.stability.score ?? "N/A"}</div>
                <div className="text-[11px] text-muted">{t("stability")} · {t("modelEstimate")}</div>
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
              <Stat label={t("last")} value={formatPrice(row.price.value, row.currency, locale)} source={row.price} />
              <Stat label={t("yield")} value={formatPct(row.yieldPct.value, locale)} source={row.yieldPct} />
              <Stat label={t("consecutive")} value={row.consecutiveYears.value == null ? "N/A" : String(row.consecutiveYears.value)} source={row.consecutiveYears} />
              <Stat label={t("divGrowth5")} value={formatPct(row.dividendCagr5Pct.value, locale)} source={row.dividendCagr5Pct} />
              <Stat label={t("cagr5")} value={formatPct(row.priceCagr5Pct.value, locale)} source={row.priceCagr5Pct} />
              <Stat label={t("cagr10")} value={formatPct(row.priceCagr10Pct.value, locale)} source={row.priceCagr10Pct} />
              <Stat label={t("payout")} value={row.payoutPct.value == null ? "N/A" : `${num(row.payoutPct.value, locale)}%`} source={row.payoutPct} />
              <Stat label={t("pe")} value={num(row.pe.value, locale)} source={row.pe} />
              <Stat label={t("beta")} value={num(row.beta.value, locale, 2)} source={row.beta} />
              <Stat label={t("debt")} value={num(row.debtToEquity.value, locale, 2)} source={row.debtToEquity} />
              <Stat label={t("coverage")} value={num(row.interestCoverage.value, locale, 1)} source={row.interestCoverage} />
            </dl>
            <button className="mt-2 text-[11px] text-info" onClick={() => setOpen(open === row.symbol ? null : row.symbol)}>{t("breakdown")}</button>
            {open === row.symbol && (
              <ul className="mt-2 space-y-1 text-[11px] text-muted">
                {row.stability.components.map((part) => <li key={part.key}>{part.key}: {part.score ?? "N/A"} — {part.detail}</li>)}
                <li>{row.stability.note}</li>
              </ul>
            )}
          </article>
        ))}
      </div>
      <section>
        <h2 className="mb-2 text-sm font-semibold">{t("rejected")}</h2>
        <ul className="space-y-1 text-xs text-muted">
          {screen.rejected.map((row) => (
            <li key={row.symbol}>
              <span className="font-mono text-ink">{row.symbol}</span> {row.name} — {row.failReasons.length ? row.failReasons.map((reason) => t(reason as MsgKey)).join("; ") : t("outsideBoard")}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value, source }: { label: string; value: string; source: Sourced<unknown> }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="num text-sm text-ink">{value}</dd>
      <dd className="text-[10px] text-muted">{source.source ?? "N/A"}</dd>
    </div>
  );
}
