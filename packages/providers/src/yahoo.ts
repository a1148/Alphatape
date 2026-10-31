import { yahooSymbol } from "./symbols";
import type { MarketDataProvider, PriceBar, Quote } from "./types";
import { ProviderDisabledError } from "./types";

export interface YahooQuoteLike {
  regularMarketPrice?: number;
  regularMarketChange?: number;
  regularMarketChangePercent?: number;
  regularMarketTime?: Date | number;
  regularMarketVolume?: number;
  regularMarketOpen?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketPreviousClose?: number;
  currency?: string;
  marketCap?: number;
  trailingPE?: number;
}

export function mapYahooQuote(symbol: string, quote: YahooQuoteLike | null | undefined): Quote | null {
  if (!quote || typeof quote.regularMarketPrice !== "number" || !(quote.regularMarketPrice > 0)) return null;
  const time = quote.regularMarketTime;
  const asOf = time instanceof Date ? time.toISOString() : typeof time === "number" && time > 0 ? new Date(time * 1000).toISOString() : null;
  if (!asOf) return null;
  return {
    symbol,
    price: quote.regularMarketPrice,
    change: typeof quote.regularMarketChange === "number" ? quote.regularMarketChange : null,
    changePercent: typeof quote.regularMarketChangePercent === "number" ? quote.regularMarketChangePercent : null,
    open: typeof quote.regularMarketOpen === "number" ? quote.regularMarketOpen : null,
    high: typeof quote.regularMarketDayHigh === "number" ? quote.regularMarketDayHigh : null,
    low: typeof quote.regularMarketDayLow === "number" ? quote.regularMarketDayLow : null,
    prevClose: typeof quote.regularMarketPreviousClose === "number" ? quote.regularMarketPreviousClose : null,
    volume: typeof quote.regularMarketVolume === "number" ? quote.regularMarketVolume : null,
    asOf,
    source: "yahoo-unofficial",
    note: "Unofficial Yahoo Finance data via the yahoo-finance2 library. Not an official market-data license.",
    currency: quote.currency ?? null,
  };
}

export function mapYahooChart(result: { quotes?: Array<Record<string, unknown>> } | null): PriceBar[] | null {
  const quotes = result?.quotes;
  if (!Array.isArray(quotes)) return null;
  const bars: PriceBar[] = [];
  for (const row of quotes) {
    const dateValue = row.date;
    const date = dateValue instanceof Date ? dateValue.toISOString().slice(0, 10) : null;
    const open = typeof row.open === "number" ? row.open : null;
    const high = typeof row.high === "number" ? row.high : null;
    const low = typeof row.low === "number" ? row.low : null;
    const close = typeof row.close === "number" ? row.close : null;
    const volume = typeof row.volume === "number" ? row.volume : null;
    if (!date || open == null || high == null || low == null || close == null || volume == null) continue;
    bars.push({ date, open, high, low, close, volume });
  }
  return bars.length ? bars : null;
}

export function createYahoo(env: NodeJS.ProcessEnv = process.env): MarketDataProvider {
  const enabled = env.YAHOO_UNOFFICIAL_ENABLED === "true";
  const reason = enabled ? null : "Unofficial Yahoo Finance adapter is off. Set YAHOO_UNOFFICIAL_ENABLED=true to opt in. There is no official key. Data is not licensed.";
  const disabled = () => {
    throw new ProviderDisabledError("yahoo-unofficial", reason ?? "disabled");
  };
  return {
    id: "yahoo-unofficial",
    displayName: "Yahoo Finance (unofficial)",
    configured: enabled,
    disabledReason: reason,
    official: false,
    capabilities: enabled
      ? { quotes: true, fundamentals: true, analyst: false, insiders: false, news: false, aggregates: true, indicators: false, websocket: false }
      : { quotes: false, fundamentals: false, analyst: false, insiders: false, news: false, aggregates: false, indicators: false, websocket: false },
    taseSupport: "partial",
    taseNotes: "Unofficial Yahoo symbols use the .TA suffix (TEVA.TA). This is a best-effort fallback, clearly marked unofficial, and disabled unless YAHOO_UNOFFICIAL_ENABLED=true.",
    docsUrl: "https://github.com/gadicc/node-yahoo-finance2",
    async getQuote(symbol) {
      if (!enabled) return disabled();
      const mod = await import("yahoo-finance2");
      const yahoo = mod.default;
      if (typeof yahoo.suppressNotices === "function") yahoo.suppressNotices(["yahooSurvey", "ripHistorical"]);
      const quote = await yahoo.quote(yahooSymbol(symbol));
      return mapYahooQuote(symbol, quote as YahooQuoteLike);
    },
    async getFundamentals(symbol) {
      if (!enabled) return disabled();
      const mod = await import("yahoo-finance2");
      const yahoo = mod.default;
      const quote = (await yahoo.quote(yahooSymbol(symbol))) as YahooQuoteLike;
      const mapped = mapYahooQuote(symbol, quote);
      if (!mapped) return null;
      return {
        symbol,
        pe: typeof quote.trailingPE === "number" ? quote.trailingPE : null,
        revenueGrowth: null,
        epsGrowth: null,
        marketCap: typeof quote.marketCap === "number" ? quote.marketCap : null,
        asOf: mapped.asOf,
        source: "yahoo-unofficial",
        note: "Only trailing P/E and market cap are read from the unofficial quote. Revenue and EPS growth are left null.",
      };
    },
    async getBars(symbol) {
      if (!enabled) return disabled();
      const mod = await import("yahoo-finance2");
      const yahoo = mod.default;
      const period1 = new Date(Date.now() - 420 * 86400000);
      const chart = await yahoo.chart(yahooSymbol(symbol), { period1, interval: "1d" });
      return mapYahooChart(chart as { quotes?: Array<Record<string, unknown>> });
    },
  };
}
