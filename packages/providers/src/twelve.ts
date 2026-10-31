import { fetchJson, num } from "./http";
import { bareSymbol, isTaseSymbol } from "./symbols";
import type { IndicatorPack, MarketDataProvider, PriceBar, Quote } from "./types";
import { ProviderDisabledError } from "./types";

function params(symbol: string, apiKey: string): string {
  if (isTaseSymbol(symbol)) {
    return `symbol=${encodeURIComponent(bareSymbol(symbol))}&exchange=TASE&apikey=${encodeURIComponent(apiKey)}`;
  }
  return `symbol=${encodeURIComponent(symbol)}&apikey=${encodeURIComponent(apiKey)}`;
}

export function parseTwelveQuote(symbol: string, body: unknown): Quote | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  if (row.status === "error" || row.code) return null;
  const price = num(row.close);
  if (price == null || price <= 0) return null;
  const stamp = typeof row.datetime === "string" ? row.datetime : null;
  const asOf = stamp && stamp.length <= 10 ? `${stamp}T00:00:00.000Z` : stamp ? new Date(stamp).toISOString() : null;
  if (!asOf || Number.isNaN(Date.parse(asOf))) return null;
  return {
    symbol,
    price,
    change: num(row.change),
    changePercent: num(row.percent_change),
    open: num(row.open),
    high: num(row.high),
    low: num(row.low),
    prevClose: num(row.previous_close),
    volume: num(row.volume),
    asOf,
    source: "twelvedata",
    note: isTaseSymbol(symbol) ? "Requested from Twelve Data with exchange=TASE." : null,
    currency: typeof row.currency === "string" ? row.currency : null,
  };
}

export function parseTwelveSeries(body: unknown): PriceBar[] | null {
  if (!body || typeof body !== "object") return null;
  const values = (body as { values?: unknown }).values;
  if (!Array.isArray(values)) return null;
  const bars: PriceBar[] = [];
  for (const item of values) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const date = typeof row.datetime === "string" ? row.datetime.slice(0, 10) : null;
    const open = num(row.open);
    const high = num(row.high);
    const low = num(row.low);
    const close = num(row.close);
    const volume = num(row.volume);
    if (!date || open == null || high == null || low == null || close == null || volume == null) continue;
    bars.push({ date, open, high, low, close, volume });
  }
  return bars.length ? bars.reverse() : null;
}

function indicatorValue(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const values = (body as { values?: unknown }).values;
  if (!Array.isArray(values) || !values.length) return null;
  const row = values[0] as Record<string, unknown>;
  return num(row.rsi ?? row.sma ?? row.macd);
}

export function createTwelve(env: NodeJS.ProcessEnv = process.env): MarketDataProvider {
  const apiKey = env.TWELVE_DATA_API_KEY?.trim() || "";
  const configured = apiKey.length > 0;
  const reason = configured ? null : "TWELVE_DATA_API_KEY is not set. Free tier: https://twelvedata.com/pricing";
  const disabled = () => {
    throw new ProviderDisabledError("twelvedata", reason ?? "disabled");
  };
  return {
    id: "twelvedata",
    displayName: "Twelve Data",
    configured,
    disabledReason: reason,
    official: true,
    capabilities: configured
      ? { quotes: true, fundamentals: false, analyst: false, insiders: false, news: false, aggregates: true, indicators: true, websocket: false }
      : { quotes: false, fundamentals: false, analyst: false, insiders: false, news: false, aggregates: false, indicators: false, websocket: false },
    taseSupport: "yes",
    taseNotes: "Tel Aviv names are requested as the bare ticker with exchange=TASE (Twelve Data market code). Example: TEVA.TA -> symbol=TEVA&exchange=TASE.",
    docsUrl: "https://twelvedata.com/docs",
    async getQuote(symbol) {
      if (!configured) return disabled();
      const body = await fetchJson(`https://api.twelvedata.com/quote?${params(symbol, apiKey)}`);
      return parseTwelveQuote(symbol, body);
    },
    async getBars(symbol) {
      if (!configured) return disabled();
      const body = await fetchJson(`https://api.twelvedata.com/time_series?${params(symbol, apiKey)}&interval=1day&outputsize=260&order=ASC`);
      return parseTwelveSeries(body);
    },
    async getIndicators(symbol) {
      if (!configured) return disabled();
      const q = params(symbol, apiKey);
      const [rsiBody, sma50Body, sma200Body, macdBody] = await Promise.all([
        fetchJson(`https://api.twelvedata.com/rsi?${q}&interval=1day&time_period=14`),
        fetchJson(`https://api.twelvedata.com/sma?${q}&interval=1day&time_period=50`),
        fetchJson(`https://api.twelvedata.com/sma?${q}&interval=1day&time_period=200`),
        fetchJson(`https://api.twelvedata.com/macd?${q}&interval=1day`),
      ]);
      const macdRow = Array.isArray((macdBody as { values?: unknown })?.values) ? ((macdBody as { values: Record<string, unknown>[] }).values[0] ?? null) : null;
      const pack: IndicatorPack = {
        rsi14: indicatorValue(rsiBody),
        sma50: indicatorValue(sma50Body),
        sma200: indicatorValue(sma200Body),
        macd: macdRow ? num(macdRow.macd) : null,
        macdSignal: macdRow ? num(macdRow.macd_signal) : null,
        macdHist: macdRow ? num(macdRow.macd_hist) : null,
        asOf: new Date().toISOString(),
        source: "twelvedata",
        note: "Twelve Data indicator endpoints do not share one as-of field; asOf is the fetch time. Null fields were absent.",
      };
      if (pack.rsi14 == null && pack.sma50 == null && pack.macd == null) return null;
      return pack;
    },
  };
}
