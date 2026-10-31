import { fetchJson, num } from "./http";
import { isTaseSymbol } from "./symbols";
import type { MarketDataProvider, PriceBar, Quote } from "./types";
import { ProviderDisabledError } from "./types";

export function parsePolygonSnapshot(symbol: string, body: unknown): Quote | null {
  if (!body || typeof body !== "object") return null;
  const ticker = (body as { ticker?: Record<string, unknown> }).ticker;
  if (!ticker) return null;
  const day = (ticker.day ?? {}) as Record<string, unknown>;
  const prev = (ticker.prevDay ?? {}) as Record<string, unknown>;
  const price = num(day.c) ?? num((ticker.min as Record<string, unknown> | undefined)?.c) ?? num(prev.c);
  if (price == null || price <= 0) return null;
  const updated = num(ticker.updated);
  return {
    symbol,
    price,
    change: num(ticker.todaysChange),
    changePercent: num(ticker.todaysChangePerc),
    open: num(day.o),
    high: num(day.h),
    low: num(day.l),
    prevClose: num(prev.c),
    volume: num(day.v),
    asOf: updated && updated > 1e12 ? new Date(updated / 1_000_000).toISOString() : updated && updated > 1e9 ? new Date(updated).toISOString() : new Date().toISOString(),
    source: "polygon",
    note: updated ? null : "Polygon snapshot had no updated timestamp; asOf is the fetch time.",
    currency: "USD",
  };
}

export function parsePolygonAggs(body: unknown): PriceBar[] | null {
  if (!body || typeof body !== "object") return null;
  const results = (body as { results?: unknown }).results;
  if (!Array.isArray(results)) return null;
  const bars: PriceBar[] = [];
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const t = num(row.t);
    const open = num(row.o);
    const high = num(row.h);
    const low = num(row.l);
    const close = num(row.c);
    const volume = num(row.v);
    if (t == null || open == null || high == null || low == null || close == null || volume == null) continue;
    bars.push({
      date: new Date(t).toISOString().slice(0, 10),
      open, high, low, close, volume,
    });
  }
  return bars.length ? bars : null;
}

export function createPolygon(env: NodeJS.ProcessEnv = process.env): MarketDataProvider {
  const apiKey = env.POLYGON_API_KEY?.trim() || "";
  const configured = apiKey.length > 0;
  const reason = configured ? null : "POLYGON_API_KEY is not set. Free tier: https://polygon.io/dashboard/signup";
  const disabled = () => {
    throw new ProviderDisabledError("polygon", reason ?? "disabled");
  };
  return {
    id: "polygon",
    displayName: "Polygon",
    configured,
    disabledReason: reason,
    official: true,
    capabilities: configured
      ? { quotes: true, fundamentals: false, analyst: false, insiders: false, news: false, aggregates: true, indicators: false, websocket: true }
      : { quotes: false, fundamentals: false, analyst: false, insiders: false, news: false, aggregates: false, indicators: false, websocket: false },
    taseSupport: "none",
    taseNotes: "Polygon's stock APIs cover US listings. .TA symbols are not requested.",
    docsUrl: "https://polygon.io/docs/stocks",
    async getQuote(symbol) {
      if (!configured) return disabled();
      if (isTaseSymbol(symbol)) return null;
      const body = await fetchJson(`https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(symbol)}?apiKey=${encodeURIComponent(apiKey)}`);
      return parsePolygonSnapshot(symbol, body);
    },
    async getBars(symbol) {
      if (!configured) return disabled();
      if (isTaseSymbol(symbol)) return null;
      const to = new Date();
      const from = new Date(to.getTime() - 420 * 86400000);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const body = await fetchJson(`https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/day/${fmt(from)}/${fmt(to)}?adjusted=true&sort=asc&limit=300&apiKey=${encodeURIComponent(apiKey)}`);
      return parsePolygonAggs(body);
    },
  };
}
