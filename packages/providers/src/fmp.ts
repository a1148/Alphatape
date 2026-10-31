import { fetchJson, num } from "./http";
import { bareSymbol, isTaseSymbol } from "./symbols";
import type { AnalystData, Fundamentals, InsiderData, MarketDataProvider, Quote } from "./types";
import { ProviderDisabledError } from "./types";

const NONE: MarketDataProvider["capabilities"] = {
  quotes: false, fundamentals: false, analyst: false, insiders: false, news: false, aggregates: false, indicators: false, websocket: false,
};

export function parseFmpDividendYears(body: unknown): Array<{ year: number; dividendPerShare: number }> | null {
  if (!Array.isArray(body)) return null;
  const byYear = new Map<number, number>();
  for (const item of body) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const date = typeof row.date === "string" ? row.date : typeof row.paymentDate === "string" ? row.paymentDate : null;
    const amount = num(row.adjDividend ?? row.dividend ?? row.amount);
    if (!date || amount == null || amount < 0) continue;
    const year = Number(date.slice(0, 4));
    if (!Number.isInteger(year)) continue;
    byYear.set(year, (byYear.get(year) ?? 0) + amount);
  }
  const years = [...byYear.entries()].map(([year, dividendPerShare]) => ({ year, dividendPerShare }));
  return years.length ? years : null;
}

export function parseFmpQuote(symbol: string, body: unknown, fetchedAt: string): Quote | null {
  const row = Array.isArray(body) ? body[0] : body;
  if (!row || typeof row !== "object") return null;
  const record = row as Record<string, unknown>;
  if (typeof record["Error Message"] === "string" || record.error) return null;
  const price = num(record.price);
  if (price == null || price <= 0) return null;
  const epoch = num(record.timestamp);
  return {
    symbol,
    price,
    change: num(record.change),
    changePercent: num(record.changePercentage ?? record.changesPercentage),
    open: num(record.open),
    high: num(record.dayHigh),
    low: num(record.dayLow),
    prevClose: num(record.previousClose),
    volume: num(record.volume),
    asOf: epoch && epoch > 0 ? new Date(epoch * 1000).toISOString() : fetchedAt,
    source: "fmp",
    note: epoch && epoch > 0 ? null : "FMP quote had no timestamp; asOf is the fetch time.",
    currency: typeof record.currency === "string" ? record.currency : null,
  };
}

function firstRow(body: unknown): Record<string, unknown> | null {
  const row = Array.isArray(body) ? body[0] : body;
  if (!row || typeof row !== "object") return null;
  return row as Record<string, unknown>;
}

export function parseFmpFundamentals(symbol: string, ratios: unknown, growth: unknown, quote: unknown, fetchedAt: string): Fundamentals | null {
  const ratio = firstRow(ratios);
  const grow = firstRow(growth);
  const q = firstRow(quote);
  const pe = num(ratio?.peRatioTTM ?? ratio?.priceToEarningsRatioTTM);
  const revenueGrowth = num(grow?.revenueGrowth ?? grow?.growthRevenue);
  const epsGrowth = num(grow?.epsgrowth ?? grow?.growthEPS ?? grow?.epsGrowth);
  const marketCap = num(q?.marketCap);
  if (pe == null && revenueGrowth == null && epsGrowth == null && marketCap == null) return null;
  const revPct = revenueGrowth != null && Math.abs(revenueGrowth) <= 2 ? revenueGrowth * 100 : revenueGrowth;
  const epsPct = epsGrowth != null && Math.abs(epsGrowth) <= 2 ? epsGrowth * 100 : epsGrowth;
  return {
    symbol,
    pe,
    revenueGrowth: revPct,
    epsGrowth: epsPct,
    marketCap,
    asOf: fetchedAt,
    source: "fmp",
    note: "Growth ratios below 2 in absolute value are treated as decimals and converted to percent. Otherwise they are used as percent.",
  };
}

export function parseFmpGrades(symbol: string, body: unknown, fetchedAt: string): AnalystData | null {
  const row = firstRow(body);
  if (!row) return null;
  const strongBuy = num(row.strongBuy ?? row.analystRatingsStrongBuy);
  const buy = num(row.buy ?? row.analystRatingsBuy);
  const hold = num(row.hold ?? row.analystRatingsHold);
  const sell = num(row.sell ?? row.analystRatingsSell);
  const strongSell = num(row.strongSell ?? row.analystRatingsStrongSell);
  const consensus = typeof row.consensus === "string" ? row.consensus.toLowerCase().replace(/\s+/g, "_") : null;
  const targetMean = num(row.targetConsensus ?? row.targetMean);
  const targetHigh = num(row.targetHigh);
  const targetLow = num(row.targetLow);
  if ([strongBuy, buy, hold, sell, strongSell, targetMean, targetHigh, targetLow].every((v) => v == null) && !consensus) return null;
  return {
    symbol, strongBuy, buy, hold, sell, strongSell,
    consensusLabel: consensus,
    targetMean, targetHigh, targetLow,
    asOf: fetchedAt,
    source: "fmp",
    note: "FMP grade/target payloads often omit an as-of timestamp; asOf is the fetch time.",
  };
}

export function createFmp(env: NodeJS.ProcessEnv = process.env): MarketDataProvider {
  const apiKey = env.FMP_API_KEY?.trim() || "";
  const configured = apiKey.length > 0;
  const reason = configured ? null : "FMP_API_KEY is not set. Free tier: https://site.financialmodelingprep.com/developer/docs";
  const base = (env.FMP_BASE_URL?.trim() || "https://financialmodelingprep.com/stable").replace(/\/$/, "");
  const disabled = () => {
    throw new ProviderDisabledError("fmp", reason ?? "disabled");
  };
  const symbolFor = (symbol: string) => (isTaseSymbol(symbol) ? `${bareSymbol(symbol)}.TA` : symbol);
  return {
    id: "fmp",
    displayName: "Financial Modeling Prep",
    configured,
    disabledReason: reason,
    official: true,
    capabilities: configured ? { quotes: true, fundamentals: true, analyst: true, insiders: true, news: false, aggregates: false, indicators: false, websocket: false } : { quotes: false, fundamentals: false, analyst: false, insiders: false, news: false, aggregates: false, indicators: false, websocket: false },
    taseSupport: "partial",
    taseNotes: "FMP accepts some Tel Aviv symbols as TICKER.TA. If the symbol is outside the plan, the adapter returns null.",
    docsUrl: "https://site.financialmodelingprep.com/developer/docs",
    async getQuote(symbol) {
      if (!configured) return disabled();
      const fetchedAt = new Date().toISOString();
      const body = await fetchJson(`${base}/quote?symbol=${encodeURIComponent(symbolFor(symbol))}&apikey=${encodeURIComponent(apiKey)}`);
      return parseFmpQuote(symbol, body, fetchedAt);
    },
    async getFundamentals(symbol) {
      if (!configured) return disabled();
      const fetchedAt = new Date().toISOString();
      const sym = encodeURIComponent(symbolFor(symbol));
      const key = encodeURIComponent(apiKey);
      const [ratios, growth, quote] = await Promise.all([
        fetchJson(`${base}/ratios-ttm?symbol=${sym}&apikey=${key}`),
        fetchJson(`${base}/financial-growth?symbol=${sym}&apikey=${key}`),
        fetchJson(`${base}/quote?symbol=${sym}&apikey=${key}`),
      ]);
      return parseFmpFundamentals(symbol, ratios, growth, quote, fetchedAt);
    },
    async getAnalyst(symbol) {
      if (!configured) return disabled();
      const fetchedAt = new Date().toISOString();
      const sym = encodeURIComponent(symbolFor(symbol));
      const key = encodeURIComponent(apiKey);
      const [grades, target] = await Promise.all([
        fetchJson(`${base}/grades-consensus?symbol=${sym}&apikey=${key}`).catch(() => null),
        fetchJson(`${base}/price-target-consensus?symbol=${sym}&apikey=${key}`).catch(() => null),
      ]);
      const merged = { ...(firstRow(grades) ?? {}), ...(firstRow(target) ?? {}) };
      return parseFmpGrades(symbol, merged, fetchedAt);
    },
    async getDividendYears(symbol) {
      if (!configured) return disabled();
      const body = await fetchJson(`${base}/dividends?symbol=${encodeURIComponent(symbolFor(symbol))}&apikey=${encodeURIComponent(apiKey)}`);
      return parseFmpDividendYears(body);
    },
    async getInsiders(symbol) {
      if (!configured) return disabled();
      const fetchedAt = new Date().toISOString();
      const body = await fetchJson(`${base}/insider-trading/statistics?symbol=${encodeURIComponent(symbolFor(symbol))}&apikey=${encodeURIComponent(apiKey)}`);
      const row = firstRow(body);
      if (!row) return null;
      const buys = num(row.totalBought ?? row.purchases);
      const sells = num(row.totalSold ?? row.sales);
      const netShares = num(row.netShares ?? row.acquiredDisposed);
      if (buys == null && sells == null && netShares == null) return null;
      return {
        symbol,
        netShares,
        netValue: num(row.totalPurchasesValue) != null && num(row.totalSalesValue) != null ? (num(row.totalPurchasesValue) as number) - (num(row.totalSalesValue) as number) : null,
        buys,
        sells,
        asOf: fetchedAt,
        source: "fmp",
        note: "Mapped from FMP insider statistics. Fields that are absent stay null.",
      } satisfies InsiderData;
    },
  };
}
