export const THEME_IDS = [
  "ai",
  "semiconductors",
  "cybersecurity",
  "cloud",
  "quantum",
  "biotech",
  "infrastructure",
  "small_cap",
  "momentum",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export type Consensus = "strong_buy" | "buy" | "hold" | "sell" | "strong_sell";

export type RiskRating = "low" | "medium" | "high" | "very_high";

export type BreakoutStatus = "insufficient_data" | "none" | "pre_breakout" | "breakout";

export type DataMode = "demo" | "live" | "mixed";

export interface Sourced<T> {
  value: T | null;
  source: string | null;
  asOf: string | null;
  note: string | null;
}

export interface FieldProvenance {
  source: string;
  asOf: string;
  note?: string;
}

export type ProvenanceMap = Record<string, FieldProvenance>;

export interface ScoreComponent {
  key: string;
  label: string;
  score: number | null;
  weight: number;
  contribution: number | null;
  detail: string;
}

export interface ScoreResult {
  modelId: string;
  modelEstimate: true;
  score: number | null;
  confidence: number | null;
  renormalized: boolean;
  weightsUsed: Record<string, number>;
  availableWeight: number;
  components: ScoreComponent[];
  risk: {
    rating: RiskRating | null;
    points: number | null;
    detail: string;
  };
  asOf: string | null;
  source: string;
  note: string;
}

export interface BreakoutResult {
  status: BreakoutStatus;
  reasons: string[];
  missing: string[];
  distanceToHighPct: number | null;
}

export interface ThemeTag {
  id: string;
  origin: "profile" | "rule" | "llm";
  rule: string;
  modelEstimate: boolean;
}

export interface ScoreInput {
  price: number | null;
  marketCap: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  shortInterest: number | null;
  institutionalOwnership: number | null;
  insiderNetValue: number | null;
  insiderBuys: number | null;
  insiderSells: number | null;
  strongBuy: number | null;
  buy: number | null;
  hold: number | null;
  sell: number | null;
  strongSell: number | null;
  consensus: Consensus | null;
  analystCount: number | null;
  targetMean: number | null;
  revisionTrend: number | null;
  rsi14: number | null;
  macdHist: number | null;
  sma50: number | null;
  sma200: number | null;
  volatility: number | null;
  themes: string[];
}

export interface StockRow {
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
  price: Sourced<number>;
  change: Sourced<number>;
  changePercent: Sourced<number>;
  open: Sourced<number>;
  high: Sourced<number>;
  low: Sourced<number>;
  prevClose: Sourced<number>;
  volume: Sourced<number>;
  avgVolume: Sourced<number>;
  marketCap: Sourced<number>;
  high52w: Sourced<number>;
  low52w: Sourced<number>;
  pe: Sourced<number>;
  revenueGrowth: Sourced<number>;
  epsGrowth: Sourced<number>;
  shortInterest: Sourced<number>;
  institutionalOwnership: Sourced<number>;
  insiderNetShares: Sourced<number>;
  insiderNetValue: Sourced<number>;
  insiderBuys: Sourced<number>;
  insiderSells: Sourced<number>;
  consensus: Sourced<string>;
  strongBuy: Sourced<number>;
  buy: Sourced<number>;
  hold: Sourced<number>;
  sell: Sourced<number>;
  strongSell: Sourced<number>;
  analystCount: Sourced<number>;
  targetMean: Sourced<number>;
  targetHigh: Sourced<number>;
  targetLow: Sourced<number>;
  revisionTrend: Sourced<number>;
  rsi14: Sourced<number>;
  macd: Sourced<number>;
  macdSignal: Sourced<number>;
  macdHist: Sourced<number>;
  sma50: Sourced<number>;
  sma200: Sourced<number>;
  volatility: Sourced<number>;
  atrContraction: Sourced<number>;
  upside: Sourced<number>;
  dataMode: DataMode;
  score: ScoreResult;
  breakout: BreakoutResult;
  themes: ThemeTag[];
}

export interface BarPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const DISCLAIMER = {
  en: "AlphaTape is not investment advice. AI scores and AI write-ups are model estimates, not guarantees and not a recommendation to buy or sell. Prices, ratings, targets, and fundamentals are shown only with a source and an as-of time. Missing values are N/A. When no market-data key is configured, figures are synthetic demo data and are labeled as such.",
  he: "אלפאטייפ אינו ייעוץ השקעות. ציוני ה-AI והטקסט של ה-AI הם הערכות מודל, לא ערובה ולא המלצה לקנות או למכור. מחירים, דירוגים, יעדים ונתונים פונדמנטליים מוצגים רק עם מקור וחותמת זמן. ערך חסר מוצג כ-N/A. כשאין מפתח ספק, המספרים הם נתוני הדגמה סינתטיים ומסומנים ככאלה.",
} as const;

export const DEMO_AS_OF = "2026-01-15T16:00:00.000Z";
