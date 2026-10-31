import { fetchJson, num } from "./http";
import { isTaseSymbol } from "./symbols";
import type { MarketDataProvider, PriceBar, Quote } from "./types";
import { ProviderDisabledError, ProviderHttpError } from "./types";

function assertNotLimited(body: unknown) {
  if (!body || typeof body !== "object") return;
  const row = body as Record<string, unknown>;
  if (typeof row.Note === "string" || typeof row.Information === "string") {
    throw new ProviderHttpError(String(row.Note ?? row.Information), 429, true);
  }
}

export function parseAlphaQuote(symbol: string, body: unknown): Quote | null {
  assertNotLimited(body);
  if (!body || typeof body !== "object") return null;
  const quote = (body as { "Global Quote"?: Record<string, unknown> })["Global Quote"];
  if (!quote) return null;
  const price = num(quote["05. price"]);
  if (price == null || price <= 0) return null;
  const day = typeof quote["07. latest trading day"] === "string" ? quote["07. latest trading day"] : null;
  if (!day) return null;
  return {
    symbol,
    price,
    change: num(quote["09. change"]),
    changePercent: num(quote["10. change percent"]),
    open: num(quote["02. open"]),
    high: num(quote["03. high"]),
    low: num(quote["04. low"]),
    prevClose: num(quote["08. previous close"]),
    volume: num(quote["06. volume"]),
    asOf: `${day}T00:00:00.000Z`,
    source: "alphavantage",
    note: "Alpha Vantage GLOBAL_QUOTE as-of is the latest trading day, not an intraday timestamp.",
    currency: null,
  };
}

export function parseAlphaDaily(body: unknown): PriceBar[] | null {
  assertNotLimited(body);
  if (!body || typeof body !== "object") return null;
  const series = (body as { "Time Series (Daily)"?: Record<string, Record<string, string>> })["Time Series (Daily)"];
  if (!series) return null;
  const bars: PriceBar[] = [];
  for (const [date, row] of Object.entries(series)) {
    const open = num(row["1. open"]);
    const high = num(row["2. high"]);
    const low = num(row["3. low"]);
    const close = num(row["4. close"]);
    const volume = num(row["5. volume"]);
    if (open == null || high == null || low == null || close == null || volume == null) continue;
    bars.push({ date, open, high, low, close, volume });
  }
  bars.sort((a, b) => a.date.localeCompare(b.date));
  return bars.length ? bars : null;
}

export function createAlphaVantage(env: NodeJS.ProcessEnv = process.env): MarketDataProvider {
  const apiKey = env.ALPHAVANTAGE_API_KEY?.trim() || "";
  const configured = apiKey.length > 0;
  const reason = configured ? null : "ALPHAVANTAGE_API_KEY is not set. Free tier: https://www.alphavantage.co/support/#api-key";
  const disabled = () => {
    throw new ProviderDisabledError("alphavantage", reason ?? "disabled");
  };
  const call = (symbol: string, fn: string) =>
    fetchJson(`https://www.alphavantage.co/query?function=${fn}&symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`);
  return {
    id: "alphavantage",
    displayName: "Alpha Vantage",
    configured,
    disabledReason: reason,
    official: true,
    capabilities: configured
      ? { quotes: true, fundamentals: false, analyst: false, insiders: false, news: false, aggregates: true, indicators: true, websocket: false }
      : { quotes: false, fundamentals: false, analyst: false, insiders: false, news: false, aggregates: false, indicators: false, websocket: false },
    taseSupport: "partial",
    taseNotes: "Some Tel Aviv symbols respond to SYMBOL.TA on Alpha Vantage. The free tier is 25 requests/day, so TASE coverage is best-effort and a miss returns null.",
    docsUrl: "https://www.alphavantage.co/documentation/",
    async getQuote(symbol) {
      if (!configured) return disabled();
      const body = await call(symbol, "GLOBAL_QUOTE");
      return parseAlphaQuote(symbol, body);
    },
    async getBars(symbol) {
      if (!configured) return disabled();
      const body = await fetchJson(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&outputsize=full&apikey=${encodeURIComponent(apiKey)}`);
      return parseAlphaDaily(body);
    },
    async getIndicators(symbol) {
      if (!configured) return disabled();
      if (isTaseSymbol(symbol)) {
        // Still attempted; many symbols will 200 with an error note and parse to null.
      }
      const rsiBody = await fetchJson(`https://www.alphavantage.co/query?function=RSI&symbol=${encodeURIComponent(symbol)}&interval=daily&time_period=14&series_type=close&apikey=${encodeURIComponent(apiKey)}`);
      assertNotLimited(rsiBody);
      const series = (rsiBody as { "Technical Analysis: RSI"?: Record<string, { RSI: string }> })["Technical Analysis: RSI"];
      const latest = series ? Object.entries(series).sort(([a], [b]) => b.localeCompare(a))[0] : null;
      if (!latest) return null;
      return {
        rsi14: num(latest[1].RSI),
        macd: null,
        macdSignal: null,
        macdHist: null,
        sma50: null,
        sma200: null,
        asOf: `${latest[0]}T00:00:00.000Z`,
        source: "alphavantage",
        note: "Only RSI is requested here to stay inside the free-tier quota. MACD and SMA stay null unless computed from bars.",
      };
    },
  };
}
