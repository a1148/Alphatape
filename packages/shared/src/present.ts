import { detectBreakout } from "./breakout";
import { computeScore, computeUpside, consensusFromCounts, emptyScoreInput, normalizeWeights, type Weights } from "./scoring";
import { classifyThemes } from "./themes";
import type { Consensus, DataMode, ProvenanceMap, ScoreInput, Sourced, StockRow } from "./types";

export interface RawStock {
  symbol: string;
  name: string;
  nameHe: string | null;
  exchange: string;
  currency: string;
  country: string;
  sector: string;
  industry: string;
  description: string | null;
  profileThemes: string[];
  llmThemes: string[];
  llmThemesAsOf: string | null;
  llmThemesModel: string | null;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  volume: number | null;
  avgVolume: number | null;
  marketCap: number | null;
  high52w: number | null;
  low52w: number | null;
  pe: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  shortInterest: number | null;
  institutionalOwnership: number | null;
  insiderNetShares: number | null;
  insiderNetValue: number | null;
  insiderBuys: number | null;
  insiderSells: number | null;
  strongBuy: number | null;
  buy: number | null;
  hold: number | null;
  sell: number | null;
  strongSell: number | null;
  targetMean: number | null;
  targetHigh: number | null;
  targetLow: number | null;
  revisionTrend: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  sma50: number | null;
  sma200: number | null;
  volatility: number | null;
  atrContraction: number | null;
  /** Optional provider-supplied consensus. Used only when it has provenance. */
  consensusLabel?: string | null;
  provenance: ProvenanceMap;
  dataMode: DataMode;
  updatedAt: string | null;
}

function field<T>(raw: RawStock, key: string, value: T | null | undefined): Sourced<T> {
  if (value === null || value === undefined || (typeof value === "number" && !Number.isFinite(value))) {
    return { value: null, source: null, asOf: null, note: null };
  }
  const meta = raw.provenance[key];
  if (!meta?.source || !meta.asOf) {
    return { value: null, source: null, asOf: null, note: "withheld_missing_provenance" };
  }
  return { value, source: meta.source, asOf: meta.asOf, note: meta.note ?? null };
}

function earlier(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a < b ? a : b;
}

function latest(values: Array<string | null>): string | null {
  const present = values.filter((v): v is string => Boolean(v));
  if (!present.length) return null;
  return present.sort().at(-1) ?? null;
}

export function scoreInputFromPresented(row: Pick<StockRow, "price" | "marketCap" | "revenueGrowth" | "epsGrowth" | "shortInterest" | "institutionalOwnership" | "insiderNetValue" | "insiderBuys" | "insiderSells" | "strongBuy" | "buy" | "hold" | "sell" | "strongSell" | "consensus" | "analystCount" | "targetMean" | "revisionTrend" | "rsi14" | "macdHist" | "sma50" | "sma200" | "volatility" | "themes">): ScoreInput {
  const consensus = row.consensus.value;
  return {
    price: row.price.value,
    marketCap: row.marketCap.value,
    revenueGrowth: row.revenueGrowth.value,
    epsGrowth: row.epsGrowth.value,
    shortInterest: row.shortInterest.value,
    institutionalOwnership: row.institutionalOwnership.value,
    insiderNetValue: row.insiderNetValue.value,
    insiderBuys: row.insiderBuys.value,
    insiderSells: row.insiderSells.value,
    strongBuy: row.strongBuy.value,
    buy: row.buy.value,
    hold: row.hold.value,
    sell: row.sell.value,
    strongSell: row.strongSell.value,
    consensus: consensus === "strong_buy" || consensus === "buy" || consensus === "hold" || consensus === "sell" || consensus === "strong_sell" ? consensus : null,
    analystCount: row.analystCount.value,
    targetMean: row.targetMean.value,
    revisionTrend: row.revisionTrend.value,
    rsi14: row.rsi14.value,
    macdHist: row.macdHist.value,
    sma50: row.sma50.value,
    sma200: row.sma200.value,
    volatility: row.volatility.value,
    themes: row.themes.map((t) => t.id),
  };
}

export function presentStock(raw: RawStock, weights?: Partial<Weights> | null): StockRow {
  const price = field(raw, "price", raw.price);
  const targetMean = field(raw, "targetMean", raw.targetMean);
  const strongBuy = field(raw, "strongBuy", raw.strongBuy);
  const buy = field(raw, "buy", raw.buy);
  const hold = field(raw, "hold", raw.hold);
  const sell = field(raw, "sell", raw.sell);
  const strongSell = field(raw, "strongSell", raw.strongSell);
  const countInputs = [strongBuy.value, buy.value, hold.value, sell.value, strongSell.value];
  const analystCountValue = countInputs.every((v) => v == null) ? null : countInputs.reduce<number>((sum, v) => sum + (v ?? 0), 0);
  const countSources = [strongBuy, buy, hold, sell, strongSell].filter((s) => s.value != null);
  const analystCount: Sourced<number> =
    analystCountValue == null
      ? { value: null, source: null, asOf: null, note: null }
      : {
          value: analystCountValue,
          source: "computed",
          asOf: latest(countSources.map((s) => s.asOf)),
          note: `Sum of rating counts from ${countSources.map((s) => s.source).join(", ") || "unknown"}`,
        };

  const labeled = field(raw, "consensusLabel", raw.consensusLabel ?? null);
  const computedConsensus = consensusFromCounts({
    strongBuy: strongBuy.value,
    buy: buy.value,
    hold: hold.value,
    sell: sell.value,
    strongSell: strongSell.value,
  });
  const consensus: Sourced<string> = labeled.value
    ? labeled
    : computedConsensus
      ? {
          value: computedConsensus,
          source: "computed",
          asOf: analystCount.asOf,
          note: "Derived from Strong Buy / Buy / Hold / Sell / Strong Sell counts. Not a separate data feed.",
        }
      : { value: null, source: null, asOf: null, note: null };

  const upsideValue = computeUpside(price.value, targetMean.value);
  const upside: Sourced<number> =
    upsideValue == null
      ? { value: null, source: null, asOf: null, note: null }
      : {
          value: upsideValue,
          source: "computed",
          asOf: earlier(price.asOf, targetMean.asOf),
          note: `Computed as (targetMean - price) / price. Inputs: price (${price.source}), targetMean (${targetMean.source}).`,
        };

  const partial: StockRow = {
    symbol: raw.symbol,
    name: raw.name,
    nameHe: raw.nameHe,
    exchange: raw.exchange,
    currency: raw.currency,
    country: raw.country,
    sector: raw.sector,
    industry: raw.industry,
    description: raw.description,
    profileThemes: raw.profileThemes,
    llmThemes: raw.llmThemes,
    llmThemesAsOf: raw.llmThemesAsOf,
    llmThemesModel: raw.llmThemesModel,
    price,
    change: field(raw, "change", raw.change),
    changePercent: field(raw, "changePercent", raw.changePercent),
    open: field(raw, "open", raw.open),
    high: field(raw, "high", raw.high),
    low: field(raw, "low", raw.low),
    prevClose: field(raw, "prevClose", raw.prevClose),
    volume: field(raw, "volume", raw.volume),
    avgVolume: field(raw, "avgVolume", raw.avgVolume),
    marketCap: field(raw, "marketCap", raw.marketCap),
    high52w: field(raw, "high52w", raw.high52w),
    low52w: field(raw, "low52w", raw.low52w),
    pe: field(raw, "pe", raw.pe),
    revenueGrowth: field(raw, "revenueGrowth", raw.revenueGrowth),
    epsGrowth: field(raw, "epsGrowth", raw.epsGrowth),
    shortInterest: field(raw, "shortInterest", raw.shortInterest),
    institutionalOwnership: field(raw, "institutionalOwnership", raw.institutionalOwnership),
    insiderNetShares: field(raw, "insiderNetShares", raw.insiderNetShares),
    insiderNetValue: field(raw, "insiderNetValue", raw.insiderNetValue),
    insiderBuys: field(raw, "insiderBuys", raw.insiderBuys),
    insiderSells: field(raw, "insiderSells", raw.insiderSells),
    consensus,
    strongBuy,
    buy,
    hold,
    sell,
    strongSell,
    analystCount,
    targetMean,
    targetHigh: field(raw, "targetHigh", raw.targetHigh),
    targetLow: field(raw, "targetLow", raw.targetLow),
    revisionTrend: field(raw, "revisionTrend", raw.revisionTrend),
    rsi14: field(raw, "rsi14", raw.rsi14),
    macd: field(raw, "macd", raw.macd),
    macdSignal: field(raw, "macdSignal", raw.macdSignal),
    macdHist: field(raw, "macdHist", raw.macdHist),
    sma50: field(raw, "sma50", raw.sma50),
    sma200: field(raw, "sma200", raw.sma200),
    volatility: field(raw, "volatility", raw.volatility),
    atrContraction: field(raw, "atrContraction", raw.atrContraction),
    upside,
    dataMode: raw.dataMode,
    score: computeScore(emptyScoreInput(), weights),
    breakout: detectBreakout({ price: null, high52w: null, volume: null, avgVolume: null, atrContraction: null, sma50: null, sma200: null }),
    themes: [],
  };

  partial.themes = classifyThemes({
    name: raw.name,
    industry: raw.industry,
    sector: raw.sector,
    description: raw.description,
    profileThemes: raw.profileThemes,
    marketCap: partial.marketCap.value,
    changePercent: partial.changePercent.value,
    rsi14: partial.rsi14.value,
    macdHist: partial.macdHist.value,
    price: partial.price.value,
    sma50: partial.sma50.value,
    llmThemes: raw.llmThemes,
    llmModel: raw.llmThemesModel,
  });

  const input = scoreInputFromPresented(partial);
  const inputAsOf = latest([
    price.asOf,
    targetMean.asOf,
    partial.revenueGrowth.asOf,
    partial.epsGrowth.asOf,
    partial.rsi14.asOf,
    partial.institutionalOwnership.asOf,
    partial.shortInterest.asOf,
    partial.insiderNetValue.asOf,
    analystCount.asOf,
    partial.revisionTrend.asOf,
    partial.volatility.asOf,
    partial.marketCap.asOf,
  ]);
  partial.score = computeScore(input, normalizeWeights(weights), inputAsOf);
  partial.breakout = detectBreakout({
    price: partial.price.value,
    high52w: partial.high52w.value,
    volume: partial.volume.value,
    avgVolume: partial.avgVolume.value,
    atrContraction: partial.atrContraction.value,
    sma50: partial.sma50.value,
    sma200: partial.sma200.value,
  });
  return partial;
}

export function rescore(row: StockRow, weights?: Partial<Weights> | null): StockRow {
  const input = scoreInputFromPresented(row);
  return { ...row, score: computeScore(input, normalizeWeights(weights), row.score.asOf) };
}

export function applyTick(
  row: StockRow,
  tick: { price: number; change: number | null; changePercent: number | null; volume: number | null; asOf: string; source: string },
): StockRow {
  if (!(tick.price > 0) || !tick.source || !tick.asOf) return row;
  const note = "Live tick. Other fundamentals are unchanged.";
  const next: StockRow = {
    ...row,
    price: { value: tick.price, source: tick.source, asOf: tick.asOf, note },
    change: tick.change == null ? row.change : { value: tick.change, source: tick.source, asOf: tick.asOf, note },
    changePercent: tick.changePercent == null ? row.changePercent : { value: tick.changePercent, source: tick.source, asOf: tick.asOf, note },
    volume: tick.volume == null ? row.volume : { value: tick.volume, source: tick.source, asOf: tick.asOf, note },
  };
  const upsideValue = computeUpside(next.price.value, next.targetMean.value);
  next.upside = upsideValue == null
    ? { value: null, source: null, asOf: null, note: null }
    : {
        value: upsideValue,
        source: "computed",
        asOf: earlier(next.price.asOf, next.targetMean.asOf),
        note: `Computed from ticked price (${tick.source}) and target (${next.targetMean.source}).`,
      };
  next.score = computeScore(scoreInputFromPresented(next), row.score.weightsUsed, tick.asOf);
  next.breakout = detectBreakout({
    price: next.price.value,
    high52w: next.high52w.value,
    volume: next.volume.value,
    avgVolume: next.avgVolume.value,
    atrContraction: next.atrContraction.value,
    sma50: next.sma50.value,
    sma200: next.sma200.value,
  });
  next.themes = classifyThemes({
    name: next.name,
    industry: next.industry,
    sector: next.sector,
    description: next.description,
    profileThemes: next.profileThemes,
    marketCap: next.marketCap.value,
    changePercent: next.changePercent.value,
    rsi14: next.rsi14.value,
    macdHist: next.macdHist.value,
    price: next.price.value,
    sma50: next.sma50.value,
    llmThemes: next.llmThemes,
    llmModel: next.llmThemesModel,
  });
  return next;
}
