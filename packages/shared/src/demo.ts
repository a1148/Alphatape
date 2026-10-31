import { detectBreakout } from "./breakout";
import { businessDaysEnding, indicatorsFromBars, roundTo } from "./indicators";
import type { BarPoint, FieldProvenance, ProvenanceMap } from "./types";
import { DEMO_AS_OF } from "./types";
import { DIVIDEND_CANDIDATES, dividendProfile } from "./dividend-universe";
import { buildAnnualSeries } from "./dividends";
import { HOT_UNIVERSE, type UniverseProfile } from "./universe";
import type { RawStock } from "./present";

const DEMO_NOTE = "Synthetic example for demo mode. Not a market quote, filing, or analyst report.";
const BAR_NOTE = "Derived from the synthetic demo OHLCV series. Not a market feed.";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function gaussian(rng: () => number): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function sanitize(bar: BarPoint): BarPoint {
  const high = Math.max(bar.open, bar.close, bar.high);
  const low = Math.min(bar.open, bar.close, bar.low, high);
  return { ...bar, high: roundTo(high, 4), low: roundTo(Math.max(low, 0.0001), 4), open: roundTo(bar.open, 4), close: roundTo(bar.close, 4) };
}

export function makeDemoBars(profile: UniverseProfile, dates: string[]): BarPoint[] {
  const rng = mulberry32(hashString(`${profile.symbol}:bars`));
  const n = dates.length;
  const raw: number[] = [1];
  for (let i = 1; i < n; i++) {
    const contract = profile.contract && i > n - 18;
    const vol = profile.vol * (contract ? 0.4 : 1);
    raw.push(raw[i - 1] * Math.exp(gaussian(rng) * vol + profile.drift));
  }
  const scale = profile.anchor / raw[n - 1];
  const closes = raw.map((price) => price * scale);
  const bars: BarPoint[] = [];
  for (let i = 0; i < n; i++) {
    const close = i === n - 1 ? profile.anchor : closes[i];
    const prev = i === 0 ? close : i === n - 1 ? closes[i - 1] : closes[i - 1];
    const open = prev;
    const wiggle = 0.004 + rng() * 0.01;
    let high = Math.max(open, close) * (1 + wiggle);
    let low = Math.min(open, close) * (1 - wiggle * 0.85);
    const baseVol = Math.max(40_000, (profile.mcapB * 1e9) / Math.max(profile.anchor, 0.01) / 90);
    let volume = baseVol * (0.55 + rng() * 0.9);
    if (profile.volSpike && i === n - 1) volume *= 2.6;
    bars.push(sanitize({ date: dates[i], open, high, low, close, volume: Math.round(volume) }));
  }
  if (profile.nearHigh) {
    const cap = profile.anchor * 1.012;
    for (const bar of bars) {
      bar.open = Math.min(bar.open, cap);
      bar.close = Math.min(bar.close, cap);
      bar.high = Math.min(Math.max(bar.high, bar.open, bar.close), cap);
      bar.low = Math.min(bar.low, bar.open, bar.close);
    }
  } else {
    const idx = Math.min(bars.length - 5, Math.floor(n * 0.22));
    bars[idx].high = roundTo(Math.max(bars[idx].high, profile.anchor * 1.22), 4);
  }
  const last = bars[bars.length - 1];
  last.close = roundTo(profile.anchor, 4);
  last.high = roundTo(Math.max(last.high, last.open, last.close, profile.nearHigh ? profile.anchor * 1.004 : last.high), 4);
  last.low = roundTo(Math.min(last.low, last.open, last.close), 4);
  return bars.map(sanitize);
}

function prov(source: string, asOf: string, note: string): FieldProvenance {
  return { source, asOf, note };
}

export interface DemoNews {
  symbol: string;
  headline: string;
  summary: string;
  url: string | null;
  sourceName: string;
  provider: string;
  publishedAt: string;
  isDemo: true;
}

export interface DemoAnnualPoint {
  symbol: string;
  year: number;
  dividendPerShare: number | null;
  close: number | null;
  source: "demo";
  isDemo: true;
  asOf: string;
}

export interface DemoDividendInput {
  symbol: string;
  eps: number | null;
  beta: number | null;
  debtToEquity: number | null;
  interestCoverage: number | null;
  provenance: ProvenanceMap;
  dataMode: "demo";
}

export interface DemoDataset {
  asOf: string;
  stocks: RawStock[];
  bars: Array<BarPoint & { symbol: string; source: string; isDemo: true }>;
  news: DemoNews[];
  annual: DemoAnnualPoint[];
  dividendInputs: DemoDividendInput[];
  lists: Record<string, Array<"hot" | "dividend">>;
}

export function generateDemoDataset(asOf = DEMO_AS_OF): DemoDataset {
  const dates = businessDaysEnding(asOf, 260);
  const stocks: RawStock[] = [];
  const bars: DemoDataset["bars"] = [];
  const news: DemoNews[] = [];
  const hotSymbols = new Set(HOT_UNIVERSE.map((profile) => profile.symbol));
  const profiles: UniverseProfile[] = [
    ...HOT_UNIVERSE,
    ...DIVIDEND_CANDIDATES.filter((candidate) => !hotSymbols.has(candidate.symbol)).map(dividendProfile),
  ];
  const lists: DemoDataset["lists"] = {};
  for (const profile of HOT_UNIVERSE) lists[profile.symbol] = ["hot"];
  for (const candidate of DIVIDEND_CANDIDATES) {
    lists[candidate.symbol] = [...(lists[candidate.symbol] ?? []), "dividend"];
  }

  for (const profile of profiles) {
    const series = makeDemoBars(profile, dates);
    const ind = indicatorsFromBars(series);
    const last = ind.last!;
    const prevClose = ind.prevClose;
    const change = prevClose == null ? null : last.close - prevClose;
    const changePercent = prevClose ? ((last.close - prevClose) / prevClose) * 100 : null;
    const provenance: ProvenanceMap = {};
    const put = (key: string, source: string, note: string) => {
      provenance[key] = prov(source, asOf, note);
    };
    const barSource = "computed:demo-bars";
    put("price", barSource, BAR_NOTE);
    if (change != null) put("change", barSource, BAR_NOTE);
    if (changePercent != null) put("changePercent", barSource, BAR_NOTE);
    put("open", barSource, BAR_NOTE);
    put("high", barSource, BAR_NOTE);
    put("low", barSource, BAR_NOTE);
    if (prevClose != null) put("prevClose", barSource, BAR_NOTE);
    put("volume", barSource, BAR_NOTE);
    if (ind.avgVolume20 != null) put("avgVolume", barSource, "Average of the prior 20 synthetic demo sessions.");
    put("marketCap", "demo", DEMO_NOTE);
    if (ind.high52w != null) put("high52w", barSource, "Max high of the synthetic series (up to 252 sessions).");
    if (ind.low52w != null) put("low52w", barSource, "Min low of the synthetic series (up to 252 sessions).");
    if (profile.pe != null) put("pe", "demo", DEMO_NOTE);
    if (profile.rev != null) put("revenueGrowth", "demo", DEMO_NOTE);
    if (profile.eps != null) put("epsGrowth", "demo", DEMO_NOTE);
    if (profile.short != null) put("shortInterest", "demo", DEMO_NOTE);
    if (profile.inst != null) put("institutionalOwnership", "demo", DEMO_NOTE);
    if (profile.insShares != null) put("insiderNetShares", "demo", DEMO_NOTE);
    if (profile.insNet != null) put("insiderNetValue", "demo", DEMO_NOTE);
    if (profile.insB != null) put("insiderBuys", "demo", DEMO_NOTE);
    if (profile.insS != null) put("insiderSells", "demo", DEMO_NOTE);
    if (profile.sb != null) put("strongBuy", "demo", DEMO_NOTE);
    if (profile.b != null) put("buy", "demo", DEMO_NOTE);
    if (profile.h != null) put("hold", "demo", DEMO_NOTE);
    if (profile.s != null) put("sell", "demo", DEMO_NOTE);
    if (profile.ss != null) put("strongSell", "demo", DEMO_NOTE);
    if (profile.target != null) put("targetMean", "demo", DEMO_NOTE);
    if (profile.target != null) {
      put("targetHigh", "demo", DEMO_NOTE);
      put("targetLow", "demo", DEMO_NOTE);
    }
    if (profile.revision != null) put("revisionTrend", "demo", "Synthetic revision index from -1 to +1, not a count of real target changes.");
    if (ind.rsi14 != null) put("rsi14", barSource, BAR_NOTE);
    if (ind.macd != null) put("macd", barSource, BAR_NOTE);
    if (ind.macdSignal != null) put("macdSignal", barSource, BAR_NOTE);
    if (ind.macdHist != null) put("macdHist", barSource, BAR_NOTE);
    if (ind.sma50 != null) put("sma50", barSource, BAR_NOTE);
    if (ind.sma200 != null) put("sma200", barSource, BAR_NOTE);
    if (ind.volatility != null) put("volatility", barSource, "Annualized realized volatility of the synthetic close series.");
    if (ind.atrContraction != null) put("atrContraction", barSource, "Recent ATR divided by the prior window ATR on the synthetic series.");

    const targetHigh = profile.target == null ? null : roundTo(profile.target * 1.12, 2);
    const targetLow = profile.target == null ? null : roundTo(profile.target * 0.82, 2);

    stocks.push({
      symbol: profile.symbol,
      name: profile.name,
      nameHe: profile.nameHe,
      exchange: profile.exchange,
      currency: profile.currency,
      country: profile.country,
      sector: profile.sector,
      industry: profile.industry,
      description: profile.description,
      profileThemes: profile.themes,
      llmThemes: [],
      llmThemesAsOf: null,
      llmThemesModel: null,
      price: last.close,
      change,
      changePercent,
      open: last.open,
      high: last.high,
      low: last.low,
      prevClose,
      volume: last.volume,
      avgVolume: ind.avgVolume20,
      marketCap: profile.mcapB * 1e9,
      high52w: ind.high52w,
      low52w: ind.low52w,
      pe: profile.pe,
      revenueGrowth: profile.rev,
      epsGrowth: profile.eps,
      shortInterest: profile.short,
      institutionalOwnership: profile.inst,
      insiderNetShares: profile.insShares,
      insiderNetValue: profile.insNet,
      insiderBuys: profile.insB,
      insiderSells: profile.insS,
      strongBuy: profile.sb,
      buy: profile.b,
      hold: profile.h,
      sell: profile.s,
      strongSell: profile.ss,
      targetMean: profile.target,
      targetHigh,
      targetLow,
      revisionTrend: profile.revision,
      rsi14: ind.rsi14,
      macd: ind.macd,
      macdSignal: ind.macdSignal,
      macdHist: ind.macdHist,
      sma50: ind.sma50,
      sma200: ind.sma200,
      volatility: ind.volatility,
      atrContraction: ind.atrContraction,
      provenance,
      dataMode: "demo",
      updatedAt: asOf,
    });

    for (const bar of series) {
      bars.push({ ...bar, symbol: profile.symbol, source: "demo", isDemo: true });
    }

    const published = ["2026-01-10T13:00:00.000Z", "2026-01-12T13:00:00.000Z", "2026-01-14T13:00:00.000Z"];
    published.forEach((publishedAt, index) => {
      news.push({
        symbol: profile.symbol,
        headline: `[DEMO] Example item ${index + 1} for ${profile.symbol} — not a real headline`,
        summary: "Synthetic demo text generated for AlphaTape demo mode. It is not sourced from a news wire and must not be read as reporting.",
        url: null,
        sourceName: "AlphaTape Demo",
        provider: "demo",
        publishedAt,
        isDemo: true,
      });
    });

    // Touch breakout so a bad series fails fast in dev if helpers throw.
    detectBreakout({
      price: last.close,
      high52w: ind.high52w,
      volume: last.volume,
      avgVolume: ind.avgVolume20,
      atrContraction: ind.atrContraction,
      sma50: ind.sma50,
      sma200: ind.sma200,
    });
  }

  const annual: DemoDataset["annual"] = [];
  const dividendInputs: DemoDataset["dividendInputs"] = [];
  for (const candidate of DIVIDEND_CANDIDATES) {
    const series = buildAnnualSeries({
      endClose: candidate.endClose,
      yieldPct: candidate.yieldPct,
      priceCagr: candidate.priceCagr,
      divCagr: candidate.divCagr,
      firstYear: candidate.firstYear,
      zeroDividendYears: candidate.zeroDividendYears,
    });
    for (const point of series) {
      annual.push({
        symbol: candidate.symbol,
        year: point.year,
        dividendPerShare: point.dividendPerShare,
        close: point.close,
        source: "demo",
        isDemo: true,
        asOf,
      });
    }
    const latest = series.at(-1);
    const eps = candidate.payout && latest?.dividendPerShare ? Math.round((latest.dividendPerShare / candidate.payout) * 10000) / 10000 : null;
    const provenance: ProvenanceMap = {};
    const note = "Synthetic example for the dividend demo. Not a filing or a market quote.";
    if (eps != null) provenance.eps = { source: "demo", asOf, note };
    if (candidate.beta != null) provenance.beta = { source: "demo", asOf, note };
    if (candidate.debtToEquity != null) provenance.debtToEquity = { source: "demo", asOf, note };
    if (candidate.interestCoverage != null) provenance.interestCoverage = { source: "demo", asOf, note };
    dividendInputs.push({
      symbol: candidate.symbol,
      eps,
      beta: candidate.beta,
      debtToEquity: candidate.debtToEquity,
      interestCoverage: candidate.interestCoverage,
      provenance,
      dataMode: "demo",
    });
  }

  return { asOf, stocks, bars, news, annual, dividendInputs, lists };
}
