import type { Consensus, RiskRating, ScoreComponent, ScoreInput, ScoreResult } from "./types";

export const SCORE_MODEL_ID = "alphatape-score-v1";

export const WEIGHT_KEYS = [
  "consensus",
  "coverage",
  "upside",
  "revisions",
  "revenueGrowth",
  "epsGrowth",
  "technicals",
  "insider",
  "institutional",
  "shortInterest",
  "risk",
] as const;

export type WeightKey = (typeof WEIGHT_KEYS)[number];
export type Weights = Record<WeightKey, number>;

export const DEFAULT_WEIGHTS: Weights = {
  consensus: 0.18,
  coverage: 0.07,
  upside: 0.16,
  revisions: 0.07,
  revenueGrowth: 0.12,
  epsGrowth: 0.1,
  technicals: 0.12,
  insider: 0.06,
  institutional: 0.05,
  shortInterest: 0.04,
  risk: 0.03,
};

export const COMPONENT_LABELS: Record<WeightKey, string> = {
  consensus: "Analyst consensus",
  coverage: "Analyst coverage",
  upside: "Upside to mean target",
  revisions: "Target revision trend",
  revenueGrowth: "Revenue growth",
  epsGrowth: "EPS growth",
  technicals: "Momentum / technicals",
  insider: "Insider activity",
  institutional: "Institutional ownership",
  shortInterest: "Short interest",
  risk: "Lower volatility risk",
};

export function emptyScoreInput(): ScoreInput {
  return {
    price: null,
    marketCap: null,
    revenueGrowth: null,
    epsGrowth: null,
    shortInterest: null,
    institutionalOwnership: null,
    insiderNetValue: null,
    insiderBuys: null,
    insiderSells: null,
    strongBuy: null,
    buy: null,
    hold: null,
    sell: null,
    strongSell: null,
    consensus: null,
    analystCount: null,
    targetMean: null,
    revisionTrend: null,
    rsi14: null,
    macdHist: null,
    sma50: null,
    sma200: null,
    volatility: null,
    themes: [],
  };
}

export function normalizeWeights(input?: Partial<Weights> | null): Weights {
  const next: Weights = { ...DEFAULT_WEIGHTS };
  if (!input) return next;
  for (const key of WEIGHT_KEYS) {
    const value = input[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100) {
      next[key] = value;
    }
  }
  return next;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function piecewise(x: number, points: Array<[number, number]>): number {
  if (!points.length) return 0;
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (x <= x1) {
      const span = x1 - x0;
      if (span === 0) return y1;
      return y0 + ((x - x0) / span) * (y1 - y0);
    }
  }
  return points[points.length - 1][1];
}

export function computeUpside(price: number | null, target: number | null): number | null {
  if (price == null || target == null || !(price > 0) || !Number.isFinite(target)) return null;
  return ((target - price) / price) * 100;
}

export function consensusFromCounts(input: Pick<ScoreInput, "strongBuy" | "buy" | "hold" | "sell" | "strongSell">): Consensus | null {
  const sb = input.strongBuy ?? 0;
  const b = input.buy ?? 0;
  const h = input.hold ?? 0;
  const s = input.sell ?? 0;
  const ss = input.strongSell ?? 0;
  const known =
    input.strongBuy != null || input.buy != null || input.hold != null || input.sell != null || input.strongSell != null;
  const total = sb + b + h + s + ss;
  if (!known || total <= 0) return null;
  const avg = (sb * 5 + b * 4 + h * 3 + s * 2 + ss * 1) / total;
  if (avg >= 4.5) return "strong_buy";
  if (avg >= 3.5) return "buy";
  if (avg >= 2.5) return "hold";
  if (avg >= 1.5) return "sell";
  return "strong_sell";
}

function consensusPoints(input: ScoreInput): { score: number; detail: string } | null {
  const sb = input.strongBuy;
  const b = input.buy;
  const h = input.hold;
  const s = input.sell;
  const ss = input.strongSell;
  const hasCounts = sb != null || b != null || h != null || s != null || ss != null;
  if (hasCounts) {
    const total = (sb ?? 0) + (b ?? 0) + (h ?? 0) + (s ?? 0) + (ss ?? 0);
    if (total > 0) {
      const score = ((sb ?? 0) * 100 + (b ?? 0) * 75 + (h ?? 0) * 50 + (s ?? 0) * 25 + (ss ?? 0) * 0) / total;
      return { score, detail: `Weighted rating mix across ${total} analyst ratings` };
    }
  }
  if (input.consensus) {
    const map: Record<Consensus, number> = {
      strong_buy: 100,
      buy: 75,
      hold: 50,
      sell: 25,
      strong_sell: 0,
    };
    return { score: map[input.consensus], detail: `Provider consensus label: ${input.consensus}` };
  }
  return null;
}

function coveragePoints(input: ScoreInput): { score: number; detail: string } | null {
  let count = input.analystCount;
  if (count == null) {
    const parts = [input.strongBuy, input.buy, input.hold, input.sell, input.strongSell];
    if (parts.every((p) => p == null)) return null;
    count = parts.reduce<number>((sum, p) => sum + (p ?? 0), 0);
  }
  const score = clamp(count / 15, 0, 1) * 100;
  return { score, detail: `${count} analysts (full marks at 15+)` };
}

function technicalPoints(input: ScoreInput): { score: number; detail: string } | null {
  const parts: Array<{ name: string; score: number }> = [];
  if (input.rsi14 != null && Number.isFinite(input.rsi14)) {
    const score = piecewise(input.rsi14, [
      [0, 40],
      [30, 70],
      [45, 75],
      [55, 92],
      [65, 88],
      [75, 55],
      [85, 30],
      [100, 20],
    ]);
    parts.push({ name: `RSI ${input.rsi14.toFixed(1)}`, score });
  }
  if (input.macdHist != null && Number.isFinite(input.macdHist)) {
    parts.push({
      name: input.macdHist > 0 ? "MACD hist > 0" : input.macdHist < 0 ? "MACD hist < 0" : "MACD hist = 0",
      score: input.macdHist > 0 ? 80 : input.macdHist < 0 ? 35 : 50,
    });
  }
  if (input.price != null && input.sma50 != null) {
    parts.push({ name: input.price > input.sma50 ? "above SMA50" : "below SMA50", score: input.price > input.sma50 ? 78 : 32 });
  }
  if (input.price != null && input.sma200 != null) {
    parts.push({ name: input.price > input.sma200 ? "above SMA200" : "below SMA200", score: input.price > input.sma200 ? 85 : 28 });
  }
  if (input.sma50 != null && input.sma200 != null) {
    parts.push({
      name: input.sma50 > input.sma200 ? "SMA50 > SMA200" : "SMA50 < SMA200",
      score: input.sma50 > input.sma200 ? 80 : 40,
    });
  }
  if (!parts.length) return null;
  const score = parts.reduce((a, p) => a + p.score, 0) / parts.length;
  return { score, detail: parts.map((p) => `${p.name} (${p.score.toFixed(0)})`).join(", ") };
}

function insiderPoints(input: ScoreInput): { score: number; detail: string } | null {
  const hasValue = input.insiderNetValue != null;
  const hasCounts = input.insiderBuys != null || input.insiderSells != null;
  if (!hasValue && !hasCounts) return null;
  if (hasValue && input.insiderNetValue! > 0) return { score: 85, detail: "Net insider value is positive" };
  if (hasValue && input.insiderNetValue! < 0) return { score: 25, detail: "Net insider value is negative" };
  if (hasValue) return { score: 55, detail: "Net insider value is flat" };
  const buys = input.insiderBuys ?? 0;
  const sells = input.insiderSells ?? 0;
  if (input.insiderBuys == null && input.insiderSells == null) return null;
  if (buys > sells) return { score: 80, detail: "More insider buy filings than sells" };
  if (buys < sells) return { score: 30, detail: "More insider sell filings than buys" };
  return { score: 55, detail: "Insider buy and sell counts are balanced" };
}

function institutionalPoints(input: ScoreInput): { score: number; detail: string } | null {
  if (input.institutionalOwnership == null) return null;
  const score = piecewise(input.institutionalOwnership, [
    [0, 30],
    [15, 50],
    [40, 85],
    [70, 80],
    [85, 60],
    [100, 45],
  ]);
  return { score, detail: `${input.institutionalOwnership}% of shares reported held by institutions` };
}

function shortPoints(input: ScoreInput): { score: number; detail: string } | null {
  if (input.shortInterest == null) return null;
  const score = piecewise(input.shortInterest, [
    [0, 68],
    [5, 78],
    [10, 60],
    [15, 40],
    [25, 22],
    [40, 15],
  ]);
  return {
    score,
    detail: `${input.shortInterest}% short. This model treats very high short interest as risk, not as a squeeze thesis.`,
  };
}

function riskComponent(input: ScoreInput): { score: number; detail: string } | null {
  if (input.volatility == null && input.marketCap == null) return null;
  let score = 70;
  const bits: string[] = [];
  if (input.volatility != null) {
    score = piecewise(input.volatility, [
      [15, 90],
      [25, 75],
      [40, 55],
      [60, 35],
      [90, 15],
    ]);
    bits.push(`realized vol ${input.volatility.toFixed(1)}%`);
  }
  if (input.marketCap != null) {
    if (input.marketCap < 3e8) {
      score -= 20;
      bits.push("micro-cap penalty");
    } else if (input.marketCap < 2e9) {
      score -= 12;
      bits.push("small-cap penalty");
    } else if (input.marketCap < 1e10) {
      score -= 4;
      bits.push("mid-cap adjustment");
    } else bits.push("large/mega cap");
  }
  return { score: clamp(score, 0, 100), detail: bits.join("; ") || "partial risk inputs" };
}

export function riskRating(input: ScoreInput): { rating: RiskRating | null; points: number | null; detail: string } {
  let points = 0;
  let signals = 0;
  const bits: string[] = [];
  if (input.volatility != null) {
    signals++;
    if (input.volatility > 60) points += 35;
    else if (input.volatility > 40) points += 22;
    else if (input.volatility > 25) points += 12;
    else points += 4;
    bits.push(`vol ${input.volatility.toFixed(1)}%`);
  }
  if (input.marketCap != null) {
    signals++;
    if (input.marketCap < 3e8) points += 30;
    else if (input.marketCap < 2e9) points += 18;
    else if (input.marketCap < 1e10) points += 8;
    bits.push("market cap bucket applied");
  }
  if (input.shortInterest != null) {
    signals++;
    if (input.shortInterest > 20) points += 18;
    else if (input.shortInterest > 10) points += 10;
    else if (input.shortInterest > 5) points += 4;
    bits.push(`short ${input.shortInterest}%`);
  }
  if (input.price != null && input.sma200 != null) {
    signals++;
    if (input.price < input.sma200) {
      points += 12;
      bits.push("below SMA200");
    }
  }
  if (input.themes.includes("biotech")) {
    signals++;
    points += 8;
    bits.push("biotech additive");
  }
  if (signals < 2) {
    return { rating: null, points: null, detail: "Need at least two risk inputs (volatility, market cap, short interest, SMA200, or biotech tag)." };
  }
  let rating: RiskRating = "very_high";
  if (points <= 15) rating = "low";
  else if (points <= 30) rating = "medium";
  else if (points <= 48) rating = "high";
  return { rating, points, detail: bits.join("; ") };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function computeScore(input: ScoreInput, weightsInput?: Partial<Weights> | null, asOf: string | null = null): ScoreResult {
  const weights = normalizeWeights(weightsInput);
  const upside = computeUpside(input.price, input.targetMean);
  const builders: Record<WeightKey, { score: number; detail: string } | null> = {
    consensus: consensusPoints(input),
    coverage: coveragePoints(input),
    upside:
      upside == null
        ? null
        : {
            score: clamp(piecewise(upside, [
              [-30, 0],
              [0, 35],
              [15, 60],
              [30, 80],
              [60, 100],
            ]), 0, 100),
            detail: `Upside ${upside.toFixed(1)}% versus mean target`,
          },
    revisions:
      input.revisionTrend == null
        ? null
        : {
            score: ((clamp(input.revisionTrend, -1, 1) + 1) / 2) * 100,
            detail: `Revision index ${input.revisionTrend.toFixed(2)} on a -1 (downgrades) to +1 (upgrades) scale`,
          },
    revenueGrowth:
      input.revenueGrowth == null
        ? null
        : {
            score: clamp(piecewise(input.revenueGrowth, [
              [-20, 0],
              [0, 40],
              [15, 65],
              [30, 85],
              [60, 100],
            ]), 0, 100),
            detail: `Revenue growth ${input.revenueGrowth}%`,
          },
    epsGrowth:
      input.epsGrowth == null
        ? null
        : {
            score: clamp(piecewise(input.epsGrowth, [
              [-30, 0],
              [0, 35],
              [20, 70],
              [40, 90],
              [80, 100],
            ]), 0, 100),
            detail: `EPS growth ${input.epsGrowth}%`,
          },
    technicals: technicalPoints(input),
    insider: insiderPoints(input),
    institutional: institutionalPoints(input),
    shortInterest: shortPoints(input),
    risk: riskComponent(input),
  };

  const components: ScoreComponent[] = WEIGHT_KEYS.map((key) => {
    const built = builders[key];
    const weight = weights[key];
    return {
      key,
      label: COMPONENT_LABELS[key],
      score: built ? round1(built.score) : null,
      weight,
      contribution: null,
      detail: built ? built.detail : "N/A — input missing, excluded from the score (not treated as zero)",
    };
  });

  const active = components.filter((c) => c.score != null && c.weight > 0);
  const availableWeight = active.reduce((sum, c) => sum + c.weight, 0);
  const totalWeight = WEIGHT_KEYS.reduce((sum, key) => sum + weights[key], 0);
  let score: number | null = null;
  if (availableWeight > 0) {
    const raw = active.reduce((sum, c) => sum + (c.score as number) * c.weight, 0) / availableWeight;
    score = round1(raw);
    for (const c of components) {
      if (c.score == null || c.weight <= 0) continue;
      c.contribution = round1(((c.score * c.weight) / availableWeight));
    }
  }

  const keyPresent = [
    input.price != null,
    input.targetMean != null,
    input.consensus != null || input.strongBuy != null || input.buy != null,
    input.revenueGrowth != null,
    input.epsGrowth != null,
    input.rsi14 != null,
    input.institutionalOwnership != null,
    input.shortInterest != null,
    input.insiderNetValue != null || input.insiderBuys != null || input.insiderSells != null,
  ].filter(Boolean).length;
  const weightCoverage = totalWeight > 0 ? availableWeight / totalWeight : 0;
  const fieldCoverage = keyPresent / 9;
  const analystFactor = input.analystCount == null ? 0.25 : clamp(input.analystCount / 12, 0, 1);
  const confidence = score == null && keyPresent === 0 ? 0 : Math.round(100 * (0.5 * weightCoverage + 0.3 * fieldCoverage + 0.2 * analystFactor));

  const risk = riskRating(input);
  const missing = components.filter((c) => c.score == null).length;

  return {
    modelId: SCORE_MODEL_ID,
    modelEstimate: true,
    score,
    confidence,
    renormalized: missing > 0 && score != null,
    weightsUsed: { ...weights },
    availableWeight: round1(availableWeight),
    components,
    risk,
    asOf,
    source: SCORE_MODEL_ID,
    note: "Model estimate, not a guarantee. Missing components are excluded and remaining weights are renormalized. This is not investment advice.",
  };
}
