import { piecewise } from "./scoring";

export const DIVIDEND_BOARD_SIZE = 15;
export const DIVIDEND_END_YEAR = 2025;
export const MIN_CONSECUTIVE_DIVIDEND_YEARS = 10;
export const MIN_PRICE_CAGR_PCT = 5;

export interface AnnualPoint {
  year: number;
  dividendPerShare: number | null;
  close: number | null;
}

export interface DividendSeriesSpec {
  endClose: number;
  yieldPct: number;
  priceCagr: number;
  divCagr: number;
  firstYear?: number;
  zeroDividendYears?: number[];
}

export interface DividendAssessment {
  passes: boolean;
  failReasons: string[];
  consecutiveYears: number | null;
  yieldPct: number | null;
  dividendCagr5Pct: number | null;
  priceCagr5Pct: number | null;
  priceCagr10Pct: number | null;
  payoutPct: number | null;
  latestDividend: number | null;
  stability: {
    modelEstimate: true;
    score: number | null;
    confidence: number | null;
    renormalized: boolean;
    source: string;
    note: string;
    components: Array<{ key: string; score: number | null; weight: number; detail: string }>;
  };
}

const WEIGHTS = {
  consecutive: 0.18,
  dividendGrowth: 0.12,
  yieldQuality: 0.1,
  payout: 0.12,
  priceCagr5: 0.12,
  priceCagr10: 0.1,
  beta: 0.1,
  debt: 0.08,
  coverage: 0.08,
} as const;

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

export function buildAnnualSeries(spec: DividendSeriesSpec): AnnualPoint[] {
  const first = spec.firstYear ?? DIVIDEND_END_YEAR - 10;
  if (!(spec.endClose > 0) || spec.yieldPct < 0) return [];
  const endDps = spec.endClose * (spec.yieldPct / 100);
  const points: AnnualPoint[] = [];
  for (let year = first; year <= DIVIDEND_END_YEAR; year++) {
    const back = DIVIDEND_END_YEAR - year;
    const priceGrowth = 1 + spec.priceCagr;
    const divGrowth = 1 + spec.divCagr;
    const close = priceGrowth === 0 ? null : spec.endClose / priceGrowth ** back;
    let dps: number | null = divGrowth === 0 ? null : endDps / divGrowth ** back;
    if (spec.zeroDividendYears?.includes(year)) dps = 0;
    points.push({
      year,
      close: close == null || !Number.isFinite(close) ? null : round4(close),
      dividendPerShare: dps == null || !Number.isFinite(dps) ? null : round4(Math.max(0, dps)),
    });
  }
  return points;
}

export function cagrPct(start: number | null | undefined, end: number | null | undefined, years: number): number | null {
  if (start == null || end == null || !(start > 0) || !(end > 0) || !(years > 0)) return null;
  const value = (Math.pow(end / start, 1 / years) - 1) * 100;
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
}

function at(points: AnnualPoint[], year: number): AnnualPoint | null {
  return points.find((point) => point.year === year) ?? null;
}

export function consecutiveDividendYears(points: AnnualPoint[], endYear = DIVIDEND_END_YEAR): number | null {
  if (!points.length) return null;
  let count = 0;
  for (let year = endYear; year >= endYear - 80; year--) {
    const point = at(points, year);
    if (!point) break;
    if (point.dividendPerShare == null || point.dividendPerShare <= 0) break;
    count += 1;
  }
  return count;
}

function component(key: string, weight: number, score: number | null, detail: string) {
  return { key, weight, score: score == null ? null : Math.round(score * 10) / 10, detail };
}

export function assessDividend(input: {
  points: AnnualPoint[];
  price: number | null;
  eps: number | null;
  beta: number | null;
  debtToEquity: number | null;
  interestCoverage: number | null;
}): DividendAssessment {
  const latest = at(input.points, DIVIDEND_END_YEAR);
  const latestDps = latest?.dividendPerShare ?? null;
  const y5 = DIVIDEND_END_YEAR - 5;
  const y10 = DIVIDEND_END_YEAR - 10;
  const priceCagr5Pct = cagrPct(at(input.points, y5)?.close, latest?.close ?? null, 5);
  const priceCagr10Pct = cagrPct(at(input.points, y10)?.close, latest?.close ?? null, 10);
  const dividendCagr5Pct = cagrPct(at(input.points, y5)?.dividendPerShare, latestDps, 5);
  const consecutiveYears = consecutiveDividendYears(input.points);
  const yieldPct = input.price != null && input.price > 0 && latestDps != null && latestDps > 0
    ? Math.round((latestDps / input.price) * 10000) / 100
    : null;
  const payoutPct = input.eps != null && input.eps > 0 && latestDps != null && latestDps >= 0
    ? Math.round((latestDps / input.eps) * 1000) / 10
    : null;

  const failReasons: string[] = [];
  if (latestDps == null || latestDps <= 0) failReasons.push("no_current_dividend");
  if (consecutiveYears == null || consecutiveYears < MIN_CONSECUTIVE_DIVIDEND_YEARS) failReasons.push("consecutive_years");
  if (priceCagr5Pct == null) failReasons.push("missing_price_cagr_5y");
  else if (priceCagr5Pct < MIN_PRICE_CAGR_PCT) failReasons.push("price_cagr_5y");
  if (priceCagr10Pct == null) failReasons.push("missing_price_cagr_10y");
  else if (priceCagr10Pct < MIN_PRICE_CAGR_PCT) failReasons.push("price_cagr_10y");

  const consecutiveScore = consecutiveYears == null ? null : piecewise(consecutiveYears, [[0, 0], [5, 35], [10, 60], [15, 80], [25, 100], [50, 100]]);
  const divScore = dividendCagr5Pct == null ? null : Math.min(100, Math.max(0, piecewise(dividendCagr5Pct, [[-10, 0], [0, 45], [5, 75], [10, 100], [20, 100]])));
  const yieldScore = yieldPct == null ? null : piecewise(yieldPct, [[0, 15], [1.5, 82], [3, 92], [5, 70], [8, 40], [12, 18]]);
  const payoutScore = payoutPct == null ? null : piecewise(payoutPct, [[0, 55], [35, 75], [55, 90], [75, 60], [100, 25], [150, 10]]);
  const cagr5Score = priceCagr5Pct == null ? null : Math.min(100, Math.max(0, piecewise(priceCagr5Pct, [[-10, 0], [0, 30], [5, 65], [10, 88], [15, 100]])));
  const cagr10Score = priceCagr10Pct == null ? null : Math.min(100, Math.max(0, piecewise(priceCagr10Pct, [[-10, 0], [0, 30], [5, 65], [10, 88], [15, 100]])));
  const betaScore = input.beta == null ? null : Math.min(100, Math.max(0, piecewise(input.beta, [[0.3, 95], [0.6, 85], [1, 65], [1.3, 40], [1.8, 20]])));
  const debtScore = input.debtToEquity == null ? null : Math.min(100, Math.max(0, piecewise(input.debtToEquity, [[0, 90], [0.5, 80], [1, 60], [2, 30], [4, 10]])));
  const coverageScore = input.interestCoverage == null ? null : Math.min(100, Math.max(0, piecewise(input.interestCoverage, [[0, 5], [2, 30], [6, 65], [12, 88], [20, 100]])));

  const components = [
    component("consecutive", WEIGHTS.consecutive, consecutiveScore, consecutiveYears == null ? "N/A" : `${consecutiveYears} consecutive years with a dividend above zero`),
    component("dividendGrowth", WEIGHTS.dividendGrowth, divScore, dividendCagr5Pct == null ? "N/A — 5y dividend CAGR needs a positive dividend at both ends" : `5y dividend CAGR ${dividendCagr5Pct}%`),
    component("yieldQuality", WEIGHTS.yieldQuality, yieldScore, yieldPct == null ? "N/A" : `Yield ${yieldPct}%. Very high yields score lower here.`),
    component("payout", WEIGHTS.payout, payoutScore, payoutPct == null ? "N/A — payout needs EPS and a dividend" : `Payout ${payoutPct}%`),
    component("priceCagr5", WEIGHTS.priceCagr5, cagr5Score, priceCagr5Pct == null ? "N/A" : `5y price CAGR ${priceCagr5Pct}%`),
    component("priceCagr10", WEIGHTS.priceCagr10, cagr10Score, priceCagr10Pct == null ? "N/A" : `10y price CAGR ${priceCagr10Pct}%`),
    component("beta", WEIGHTS.beta, betaScore, input.beta == null ? "N/A" : `Beta ${input.beta}`),
    component("debt", WEIGHTS.debt, debtScore, input.debtToEquity == null ? "N/A" : `Debt/equity ${input.debtToEquity}`),
    component("coverage", WEIGHTS.coverage, coverageScore, input.interestCoverage == null ? "N/A" : `Interest coverage ${input.interestCoverage}`),
  ];
  const active = components.filter((item) => item.score != null && item.weight > 0);
  const weightSum = active.reduce((sum, item) => sum + item.weight, 0);
  const totalWeight = Object.values(WEIGHTS).reduce((sum, weight) => sum + weight, 0);
  const score = weightSum > 0 ? Math.round((active.reduce((sum, item) => sum + (item.score as number) * item.weight, 0) / weightSum) * 10) / 10 : null;
  const confidence = Math.round(100 * (0.65 * (weightSum / totalWeight) + 0.35 * (consecutiveYears == null ? 0 : Math.min(consecutiveYears / 15, 1))));

  return {
    passes: failReasons.length === 0,
    failReasons,
    consecutiveYears,
    yieldPct,
    dividendCagr5Pct,
    priceCagr5Pct,
    priceCagr10Pct,
    payoutPct,
    latestDividend: latestDps,
    stability: {
      modelEstimate: true,
      score,
      confidence,
      renormalized: components.some((item) => item.score == null) && score != null,
      source: "alphatape-dividend-stability-v1",
      note: "Model estimate for a 2–10 year dividend screen. Past dividend payments and past price CAGR are not a forecast and not a guarantee. Missing inputs are excluded, not treated as zero. This is not investment advice.",
      components,
    },
  };
}

export function rankDividendBoard<T extends { assessment: DividendAssessment }>(rows: T[], limit = DIVIDEND_BOARD_SIZE): { board: T[]; rejected: T[] } {
  const board = rows.filter((row) => row.assessment.passes).sort((a, b) => (b.assessment.stability.score ?? -1) - (a.assessment.stability.score ?? -1)).slice(0, limit);
  const chosen = new Set(board);
  const rejected = rows.filter((row) => !chosen.has(row));
  return { board, rejected };
}
