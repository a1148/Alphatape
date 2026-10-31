export interface Quote {
  symbol: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  prevClose: number | null;
  volume: number | null;
  asOf: string;
  source: string;
  note: string | null;
  currency: string | null;
}

export interface Fundamentals {
  symbol: string;
  pe: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  marketCap: number | null;
  asOf: string;
  source: string;
  note: string | null;
}

export interface AnalystData {
  symbol: string;
  strongBuy: number | null;
  buy: number | null;
  hold: number | null;
  sell: number | null;
  strongSell: number | null;
  consensusLabel: string | null;
  targetMean: number | null;
  targetHigh: number | null;
  targetLow: number | null;
  asOf: string;
  source: string;
  note: string | null;
}

export interface InsiderData {
  symbol: string;
  netShares: number | null;
  netValue: number | null;
  buys: number | null;
  sells: number | null;
  asOf: string;
  source: string;
  note: string | null;
}

export interface NewsItem {
  symbol: string;
  headline: string;
  summary: string | null;
  url: string | null;
  sourceName: string;
  publishedAt: string;
  provider: string;
}

export interface PriceBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorPack {
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  sma50: number | null;
  sma200: number | null;
  asOf: string;
  source: string;
  note: string | null;
}

export type TaseSupport = "none" | "partial" | "yes";

export interface ProviderCapabilities {
  quotes: boolean;
  fundamentals: boolean;
  analyst: boolean;
  insiders: boolean;
  news: boolean;
  aggregates: boolean;
  indicators: boolean;
  websocket: boolean;
}

export interface MarketDataProvider {
  id: string;
  displayName: string;
  configured: boolean;
  disabledReason: string | null;
  /** False for the unofficial Yahoo adapter and for unlicensed stubs. */
  official: boolean;
  capabilities: ProviderCapabilities;
  taseSupport: TaseSupport;
  taseNotes: string;
  docsUrl: string;
  getQuote?(symbol: string): Promise<Quote | null>;
  getFundamentals?(symbol: string): Promise<Fundamentals | null>;
  getAnalyst?(symbol: string): Promise<AnalystData | null>;
  getInsiders?(symbol: string): Promise<InsiderData | null>;
  getNews?(symbol: string): Promise<NewsItem[] | null>;
  getBars?(symbol: string): Promise<PriceBar[] | null>;
  getIndicators?(symbol: string): Promise<IndicatorPack | null>;
  getDividendYears?(symbol: string): Promise<Array<{ year: number; dividendPerShare: number }> | null>;
}

export class ProviderDisabledError extends Error {
  readonly code = "PROVIDER_DISABLED";
  constructor(id: string, reason: string) {
    super(`${id} is disabled: ${reason}`);
  }
}

export class ProviderHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}
