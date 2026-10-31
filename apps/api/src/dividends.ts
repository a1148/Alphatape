import { prisma } from "@alphatape/db";
import {
  DIVIDEND_BOARD_SIZE,
  MIN_CONSECUTIVE_DIVIDEND_YEARS,
  MIN_PRICE_CAGR_PCT,
  assessDividend,
  presentStock,
  type ProvenanceMap,
  type Weights,
} from "@alphatape/shared";
import { toRaw } from "./map";

function asProvenance(value: unknown): ProvenanceMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as ProvenanceMap;
}

function gated(value: number | null, provenance: ProvenanceMap, key: string): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const meta = provenance[key];
  if (!meta?.source || !meta.asOf) return null;
  return value;
}

export async function loadDividendScreen(weights: Weights) {
  const stocks = await prisma.stock.findMany({ where: { active: true, lists: { has: "dividend" } }, orderBy: { symbol: "asc" } });
  const symbols = stocks.map((stock) => stock.symbol);
  const [snaps, inputs, points] = await Promise.all([
    prisma.marketSnapshot.findMany({ where: { symbol: { in: symbols } } }),
    prisma.dividendSnapshot.findMany({ where: { symbol: { in: symbols } } }),
    prisma.annualPoint.findMany({ where: { symbol: { in: symbols } }, orderBy: { year: "asc" } }),
  ]);
  const snapBy = new Map(snaps.map((snap) => [snap.symbol, snap]));
  const inputBy = new Map(inputs.map((input) => [input.symbol, input]));
  const pointsBy = new Map<string, typeof points>();
  for (const point of points) {
    const list = pointsBy.get(point.symbol) ?? [];
    list.push(point);
    pointsBy.set(point.symbol, list);
  }

  const rows = stocks.map((stock) => {
    const presented = presentStock(toRaw(stock, snapBy.get(stock.symbol) ?? null), weights);
    const input = inputBy.get(stock.symbol);
    const provenance = asProvenance(input?.provenance);
    const annual = (pointsBy.get(stock.symbol) ?? []).filter((point) => point.source);
    const seriesSource = annual.every((point) => point.isDemo) && annual.length ? "computed:demo-annual" : annual.length ? "computed:annual" : null;
    const asOf = annual.map((point) => point.asOf.toISOString()).sort().at(-1) ?? null;
    const assessment = assessDividend({
      points: annual.map((point) => ({ year: point.year, dividendPerShare: point.dividendPerShare, close: point.close })),
      price: presented.price.value,
      eps: gated(input?.eps ?? null, provenance, "eps"),
      beta: gated(input?.beta ?? null, provenance, "beta"),
      debtToEquity: gated(input?.debtToEquity ?? null, provenance, "debtToEquity"),
      interestCoverage: gated(input?.interestCoverage ?? null, provenance, "interestCoverage"),
    });
    const computed = (value: number | null, note: string) => value == null || !seriesSource || !asOf
      ? { value: null, source: null, asOf: null, note: null }
      : { value, source: seriesSource, asOf, note };
    return {
      symbol: stock.symbol,
      name: stock.name,
      nameHe: stock.nameHe,
      exchange: stock.exchange,
      currency: stock.currency,
      sector: stock.sector,
      industry: stock.industry,
      description: stock.description,
      price: presented.price,
      marketCap: presented.marketCap,
      pe: presented.pe,
      risk: presented.score.risk,
      beta: { value: gated(input?.beta ?? null, provenance, "beta"), source: provenance.beta?.source ?? null, asOf: provenance.beta?.asOf ?? null, note: provenance.beta?.note ?? null },
      debtToEquity: { value: gated(input?.debtToEquity ?? null, provenance, "debtToEquity"), source: provenance.debtToEquity?.source ?? null, asOf: provenance.debtToEquity?.asOf ?? null, note: provenance.debtToEquity?.note ?? null },
      interestCoverage: { value: gated(input?.interestCoverage ?? null, provenance, "interestCoverage"), source: provenance.interestCoverage?.source ?? null, asOf: provenance.interestCoverage?.asOf ?? null, note: provenance.interestCoverage?.note ?? null },
      yieldPct: computed(assessment.yieldPct, "Latest annual dividend divided by the latest price. Not a forward yield."),
      consecutiveYears: computed(assessment.consecutiveYears, "Unbroken years ending at the latest year with a dividend above zero."),
      dividendCagr5Pct: computed(assessment.dividendCagr5Pct, "CAGR of annual dividends over 5 years. Null if either endpoint is missing or zero."),
      priceCagr5Pct: computed(assessment.priceCagr5Pct, "CAGR of year-end closes over 5 years."),
      priceCagr10Pct: computed(assessment.priceCagr10Pct, "CAGR of year-end closes over 10 years."),
      payoutPct: assessment.payoutPct == null || !seriesSource || !asOf || !provenance.eps
        ? { value: null, source: null, asOf: null, note: null }
        : { value: assessment.payoutPct, source: "computed", asOf, note: `Latest annual dividend (${seriesSource}) divided by EPS (${provenance.eps.source}).` },
      stability: assessment.stability,
      passes: assessment.passes,
      failReasons: assessment.failReasons,
    };
  });

  const passing = rows.filter((row) => row.passes).sort((a, b) => (b.stability.score ?? -1) - (a.stability.score ?? -1));
  const boardRows = passing.slice(0, DIVIDEND_BOARD_SIZE);
  const boardSymbols = new Set(boardRows.map((row) => row.symbol));
  return {
    gates: {
      minConsecutiveYears: MIN_CONSECUTIVE_DIVIDEND_YEARS,
      minPriceCagr5Pct: MIN_PRICE_CAGR_PCT,
      minPriceCagr10Pct: MIN_PRICE_CAGR_PCT,
    },
    screened: rows.length,
    passed: passing.length,
    board: boardRows,
    rejected: rows.filter((row) => !boardSymbols.has(row.symbol)).map((row) => ({
      symbol: row.symbol,
      name: row.name,
      passes: row.passes,
      failReasons: row.failReasons,
      stability: row.stability.score,
    })),
  };
}
