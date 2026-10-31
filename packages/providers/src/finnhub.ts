import { fetchJson, num } from "./http";
import { isTaseSymbol } from "./symbols";
import type { AnalystData, InsiderData, MarketDataProvider, NewsItem, Quote } from "./types";
import { ProviderDisabledError } from "./types";

const NONE: MarketDataProvider["capabilities"] = {
  quotes: false, fundamentals: false, analyst: false, insiders: false, news: false, aggregates: false, indicators: false, websocket: false,
};

export function parseFinnhubQuote(symbol: string, body: unknown): Quote | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const price = num(row.c);
  const epoch = num(row.t);
  if (price == null || price <= 0 || epoch == null || epoch <= 0) return null;
  return {
    symbol,
    price,
    change: num(row.d),
    changePercent: num(row.dp),
    open: num(row.o),
    high: num(row.h),
    low: num(row.l),
    prevClose: num(row.pc),
    volume: null,
    asOf: new Date(epoch * 1000).toISOString(),
    source: "finnhub",
    note: "Finnhub /quote does not include volume.",
    currency: null,
  };
}

export function parseFinnhubRecommendations(symbol: string, body: unknown): AnalystData | null {
  if (!Array.isArray(body) || body.length === 0) return null;
  const row = body[0] as Record<string, unknown>;
  const strongBuy = num(row.strongBuy);
  const buy = num(row.buy);
  const hold = num(row.hold);
  const sell = num(row.sell);
  const strongSell = num(row.strongSell);
  if ([strongBuy, buy, hold, sell, strongSell].every((v) => v == null)) return null;
  const period = typeof row.period === "string" ? row.period : null;
  return {
    symbol,
    strongBuy, buy, hold, sell, strongSell,
    consensusLabel: null,
    targetMean: null,
    targetHigh: null,
    targetLow: null,
    asOf: period ? new Date(`${period}T00:00:00.000Z`).toISOString() : new Date(0).toISOString(),
    source: "finnhub",
    note: "Most recent Finnhub recommendation-trend row. Price target is a separate endpoint.",
  };
}

export function parseFinnhubTarget(symbol: string, body: unknown, fetchedAt: string): Pick<AnalystData, "targetMean" | "targetHigh" | "targetLow" | "asOf" | "note"> | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const targetMean = num(row.targetMean);
  const targetHigh = num(row.targetHigh);
  const targetLow = num(row.targetLow);
  if (targetMean == null && targetHigh == null && targetLow == null) return null;
  return {
    targetMean, targetHigh, targetLow,
    asOf: fetchedAt,
    note: "Finnhub price-target payload has no as-of field; asOf is the fetch time.",
  };
}

export function parseFinnhubInsiders(symbol: string, body: unknown, fetchedAt: string): InsiderData | null {
  if (!body || typeof body !== "object") return null;
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  let netShares = 0;
  let netValue = 0;
  let buys = 0;
  let sells = 0;
  let saw = false;
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const change = num(row.change);
    const price = num(row.transactionPrice);
    const code = String(row.transactionCode ?? "").toUpperCase();
    if (change == null) continue;
    saw = true;
    netShares += change;
    if (price != null) netValue += change * price;
    if (code === "P" || code === "A" || change > 0) buys += 1;
    else if (code === "S" || change < 0) sells += 1;
  }
  if (!saw) {
    return {
      symbol, netShares: 0, netValue: 0, buys: 0, sells: 0, asOf: fetchedAt, source: "finnhub",
      note: "Finnhub returned no insider rows in this page. Zero means none in the payload, not a complete history.",
    };
  }
  return {
    symbol,
    netShares,
    netValue,
    buys,
    sells,
    asOf: fetchedAt,
    source: "finnhub",
    note: "Aggregated from the Finnhub insider-transactions page only, not a full filing history.",
  };
}

export function parseFinnhubNews(symbol: string, body: unknown): NewsItem[] | null {
  if (!Array.isArray(body)) return null;
  const items: NewsItem[] = [];
  for (const item of body) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const headline = typeof row.headline === "string" ? row.headline.trim() : "";
    const epoch = num(row.datetime);
    if (!headline || epoch == null) continue;
    items.push({
      symbol,
      headline,
      summary: typeof row.summary === "string" ? row.summary : null,
      url: typeof row.url === "string" ? row.url : null,
      sourceName: typeof row.source === "string" ? row.source : "finnhub",
      publishedAt: new Date(epoch * 1000).toISOString(),
      provider: "finnhub",
    });
  }
  return items;
}

export function createFinnhub(env: NodeJS.ProcessEnv = process.env): MarketDataProvider {
  const apiKey = env.FINNHUB_API_KEY?.trim() || "";
  const configured = apiKey.length > 0;
  const reason = configured ? null : "FINNHUB_API_KEY is not set. Free tier: https://finnhub.io/register";
  const base = "https://finnhub.io/api/v1";
  const disabled = () => {
    throw new ProviderDisabledError("finnhub", reason ?? "disabled");
  };
  return {
    id: "finnhub",
    displayName: "Finnhub",
    configured,
    disabledReason: reason,
    official: true,
    capabilities: configured ? { ...NONE, quotes: true, analyst: true, insiders: true, news: true, websocket: true } : NONE,
    taseSupport: "partial",
    taseNotes: "Finnhub uses a .TA suffix for some Tel Aviv names (for example TEVA.TA). Coverage on the free tier is limited; a miss returns null rather than a substitute price.",
    docsUrl: "https://finnhub.io/docs/api",
    async getQuote(symbol) {
      if (!configured) return disabled();
      const body = await fetchJson(`${base}/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`);
      return parseFinnhubQuote(symbol, body);
    },
    async getAnalyst(symbol) {
      if (!configured) return disabled();
      const fetchedAt = new Date().toISOString();
      const rec = parseFinnhubRecommendations(symbol, await fetchJson(`${base}/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`));
      const target = parseFinnhubTarget(symbol, await fetchJson(`${base}/stock/price-target?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`), fetchedAt);
      if (!rec && !target) return null;
      return {
        symbol,
        strongBuy: rec?.strongBuy ?? null,
        buy: rec?.buy ?? null,
        hold: rec?.hold ?? null,
        sell: rec?.sell ?? null,
        strongSell: rec?.strongSell ?? null,
        consensusLabel: null,
        targetMean: target?.targetMean ?? null,
        targetHigh: target?.targetHigh ?? null,
        targetLow: target?.targetLow ?? null,
        asOf: rec?.asOf && rec.asOf !== new Date(0).toISOString() ? rec.asOf : fetchedAt,
        source: "finnhub",
        note: [rec?.note, target?.note].filter(Boolean).join(" "),
      };
    },
    async getInsiders(symbol) {
      if (!configured) return disabled();
      const fetchedAt = new Date().toISOString();
      const body = await fetchJson(`${base}/stock/insider-transactions?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(apiKey)}`);
      return parseFinnhubInsiders(symbol, body, fetchedAt);
    },
    async getNews(symbol) {
      if (!configured) return disabled();
      const to = new Date();
      const from = new Date(to.getTime() - 14 * 86400000);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const body = await fetchJson(`${base}/company-news?symbol=${encodeURIComponent(isTaseSymbol(symbol) ? symbol : symbol)}&from=${fmt(from)}&to=${fmt(to)}&token=${encodeURIComponent(apiKey)}`);
      return parseFinnhubNews(symbol, body);
    },
  };
}
