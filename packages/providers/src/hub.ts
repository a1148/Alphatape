import { CircuitBreaker } from "./circuit";
import { PROVIDER_MIN_INTERVAL_MS, RateLimiter } from "./rate-limit";
import { withRetry } from "./retry";
import { isTaseSymbol } from "./symbols";
import type { AnalystData, Fundamentals, IndicatorPack, InsiderData, MarketDataProvider, NewsItem, PriceBar, Quote } from "./types";

export interface HubLogger {
  warn(obj: Record<string, unknown>, msg?: string): void;
}

const silent: HubLogger = { warn() {} };

export class ProviderHub {
  private limiters = new Map<string, RateLimiter>();
  private breaker = new CircuitBreaker(5, 60_000);

  constructor(
    private providers: MarketDataProvider[],
    private log: HubLogger = silent,
  ) {}

  list(): MarketDataProvider[] {
    return this.providers;
  }

  private limiter(id: string): RateLimiter {
    let limiter = this.limiters.get(id);
    if (!limiter) {
      limiter = new RateLimiter(PROVIDER_MIN_INTERVAL_MS[id] ?? 1000);
      this.limiters.set(id, limiter);
    }
    return limiter;
  }

  private candidates(order: string[], symbol: string): MarketDataProvider[] {
    const tase = isTaseSymbol(symbol);
    const out: MarketDataProvider[] = [];
    for (const id of order) {
      const provider = this.providers.find((item) => item.id === id);
      if (!provider?.configured) continue;
      if (tase && provider.taseSupport === "none") continue;
      out.push(provider);
    }
    return out;
  }

  private async guard<T>(provider: MarketDataProvider, op: string, fn: () => Promise<T>): Promise<T> {
    await this.limiter(provider.id).take();
    return this.breaker.exec(`${provider.id}:${op}`, () => withRetry(fn, { retries: 3, baseMs: 50 }));
  }

  private async first<T>(order: string[], symbol: string, op: string, call: (provider: MarketDataProvider) => (() => Promise<T | null>) | undefined): Promise<{ value: T | null; provider: string | null; errors: string[] }> {
    const errors: string[] = [];
    for (const provider of this.candidates(order, symbol)) {
      const fn = call(provider);
      if (!fn) continue;
      try {
        const value = await this.guard(provider, op, fn);
        if (value) return { value, provider: provider.id, errors };
        errors.push(`${provider.id}: empty`);
      } catch (error) {
        const message = error instanceof Error ? error.message : "error";
        errors.push(`${provider.id}: ${message}`);
        this.log.warn({ provider: provider.id, symbol, op, err: message }, "provider call failed");
      }
    }
    return { value: null, provider: null, errors };
  }

  getQuote(symbol: string) {
    return this.first<Quote>(["polygon", "finnhub", "twelvedata", "alphavantage", "yahoo-unofficial"], symbol, "quote", (p) => (p.getQuote ? () => p.getQuote!(symbol) : undefined));
  }

  getFundamentals(symbol: string) {
    return this.first<Fundamentals>(["fmp", "yahoo-unofficial"], symbol, "fundamentals", (p) => (p.getFundamentals ? () => p.getFundamentals!(symbol) : undefined));
  }

  getAnalyst(symbol: string) {
    return this.first<AnalystData>(["finnhub", "fmp"], symbol, "analyst", (p) => (p.getAnalyst ? () => p.getAnalyst!(symbol) : undefined));
  }

  getInsiders(symbol: string) {
    return this.first<InsiderData>(["finnhub", "fmp"], symbol, "insiders", (p) => (p.getInsiders ? () => p.getInsiders!(symbol) : undefined));
  }

  getNews(symbol: string) {
    return this.first<NewsItem[]>(["finnhub"], symbol, "news", (p) => (p.getNews ? () => p.getNews!(symbol) : undefined));
  }

  getBars(symbol: string) {
    return this.first<PriceBar[]>(["polygon", "twelvedata", "alphavantage", "yahoo-unofficial"], symbol, "bars", (p) => (p.getBars ? () => p.getBars!(symbol) : undefined));
  }

  getIndicators(symbol: string) {
    return this.first<IndicatorPack>(["twelvedata", "alphavantage"], symbol, "indicators", (p) => (p.getIndicators ? () => p.getIndicators!(symbol) : undefined));
  }

  getDividendYears(symbol: string) {
    return this.first<Array<{ year: number; dividendPerShare: number }>>(["fmp"], symbol, "dividends", (p) => (p.getDividendYears ? () => p.getDividendYears!(symbol) : undefined));
  }
}
