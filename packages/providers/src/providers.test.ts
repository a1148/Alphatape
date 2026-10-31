import { afterEach, describe, expect, it, vi } from "vitest";
import { CircuitBreaker } from "./circuit";
import { parseFinnhubInsiders, parseFinnhubQuote, parseFinnhubRecommendations } from "./finnhub";
import { parseFmpQuote } from "./fmp";
import { ProviderHub } from "./hub";
import { parseAlphaQuote } from "./alphavantage";
import { parsePolygonSnapshot } from "./polygon";
import { withRetry } from "./retry";
import { createMarketWatchStub, createSeekingAlphaStub, createTipRanksStub } from "./stubs";
import { parseTwelveQuote } from "./twelve";
import { ProviderHttpError, type MarketDataProvider, type Quote } from "./types";
import { mapYahooQuote } from "./yahoo";
import { buildProviders } from "./index";

const quote = (symbol: string, source: string): Quote => ({
  symbol,
  price: 10,
  change: 1,
  changePercent: 1,
  open: 9,
  high: 11,
  low: 9,
  prevClose: 9,
  volume: 100,
  asOf: "2026-01-15T16:00:00.000Z",
  source,
  note: null,
  currency: "USD",
});

function fake(partial: Partial<MarketDataProvider> & Pick<MarketDataProvider, "id">): MarketDataProvider {
  return {
    displayName: partial.id,
    configured: true,
    disabledReason: null,
    official: true,
    capabilities: { quotes: true, fundamentals: false, analyst: false, insiders: false, news: false, aggregates: false, indicators: false, websocket: false },
    taseSupport: "partial",
    taseNotes: "",
    docsUrl: "",
    ...partial,
  };
}

describe("provider parsers", () => {
  it("parses a Finnhub quote and rejects an empty quote", () => {
    const parsed = parseFinnhubQuote("NVDA", { c: 120.5, d: 1, dp: 0.8, h: 121, l: 119, o: 119.5, pc: 119.5, t: 1768492800 });
    expect(parsed?.price).toBe(120.5);
    expect(parsed?.source).toBe("finnhub");
    expect(parsed?.volume).toBeNull();
    expect(parseFinnhubQuote("NVDA", { c: 0, t: 0 })).toBeNull();
  });

  it("parses Finnhub recommendations and insider rows without inventing names", () => {
    const rec = parseFinnhubRecommendations("NVDA", [{ strongBuy: 10, buy: 4, hold: 2, sell: 0, strongSell: 0, period: "2026-01-01" }]);
    expect(rec?.strongBuy).toBe(10);
    expect(rec?.targetMean).toBeNull();
    const insiders = parseFinnhubInsiders("NVDA", { data: [{ change: 100, transactionPrice: 10, transactionCode: "P" }, { change: -40, transactionPrice: 11, transactionCode: "S" }] }, "2026-01-15T00:00:00.000Z");
    expect(insiders?.netShares).toBe(60);
    expect(insiders?.buys).toBe(1);
    expect(insiders?.sells).toBe(1);
  });

  it("parses FMP, Polygon, Twelve Data, and Alpha Vantage quotes", () => {
    expect(parseFmpQuote("AMD", [{ price: 140, change: 1, changesPercentage: 0.7, timestamp: 1768492800 }], "2026-01-15T00:00:00.000Z")?.price).toBe(140);
    expect(parsePolygonSnapshot("AMD", { ticker: { day: { c: 140, o: 139, h: 141, l: 138, v: 10 }, prevDay: { c: 139 }, todaysChange: 1, todaysChangePerc: 0.7, updated: 1768492800000000000 } })?.source).toBe("polygon");
    expect(parseTwelveQuote("TEVA.TA", { close: "1800", previous_close: "1790", percent_change: "0.5", datetime: "2026-01-15" })?.note).toMatch(/TASE/);
    expect(parseTwelveQuote("TEVA.TA", { status: "error", code: 400 })).toBeNull();
    expect(parseAlphaQuote("IBM", { "Global Quote": { "05. price": "100.5", "07. latest trading day": "2026-01-15", "10. change percent": "1.2%" } })?.changePercent).toBeCloseTo(1.2);
  });

  it("marks Yahoo quotes as unofficial and drops them without a timestamp", () => {
    const mapped = mapYahooQuote("TEVA.TA", { regularMarketPrice: 18, regularMarketTime: new Date("2026-01-15T16:00:00.000Z"), currency: "USD" });
    expect(mapped?.source).toBe("yahoo-unofficial");
    expect(mapped?.note).toMatch(/Unofficial/);
    expect(mapYahooQuote("TEVA.TA", { regularMarketPrice: 18 })).toBeNull();
  });
});

describe("guards", () => {
  it("opens the circuit after repeated failures", async () => {
    const breaker = new CircuitBreaker(2, 60_000);
    await expect(breaker.exec("k", async () => { throw new Error("x"); })).rejects.toThrow("x");
    await expect(breaker.exec("k", async () => { throw new Error("x"); })).rejects.toThrow("x");
    await expect(breaker.exec("k", async () => "ok")).rejects.toThrow(/circuit_open/);
  });

  it("retries retryable HTTP errors and then succeeds", async () => {
    let calls = 0;
    const value = await withRetry(async () => {
      calls += 1;
      if (calls < 3) throw new ProviderHttpError("HTTP 503", 503, true);
      return "ok";
    }, { retries: 3, baseMs: 1 });
    expect(value).toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry a 400", async () => {
    let calls = 0;
    await expect(withRetry(async () => {
      calls += 1;
      throw new ProviderHttpError("HTTP 400", 400, false);
    }, { retries: 3, baseMs: 1 })).rejects.toThrow(/400/);
    expect(calls).toBe(1);
  });
});

describe("hub and stubs", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips Polygon for TASE symbols and uses the next provider", async () => {
    let polygonCalls = 0;
    const hub = new ProviderHub([
      fake({ id: "polygon", taseSupport: "none", getQuote: async () => { polygonCalls += 1; return quote("TEVA.TA", "polygon"); } }),
      fake({ id: "twelvedata", taseSupport: "yes", getQuote: async () => quote("TEVA.TA", "twelvedata") }),
    ]);
    const result = await hub.getQuote("TEVA.TA");
    expect(polygonCalls).toBe(0);
    expect(result.provider).toBe("twelvedata");
    expect(result.value?.source).toBe("twelvedata");
  });

  it("returns null instead of inventing a quote when every provider fails", async () => {
    const hub = new ProviderHub([
      fake({ id: "finnhub", getQuote: async () => { throw new ProviderHttpError("HTTP 500", 500, false); } }),
    ]);
    const result = await hub.getQuote("NVDA");
    expect(result.value).toBeNull();
    expect(result.errors[0]).toMatch(/finnhub/);
  });

  it("keeps Seeking Alpha, TipRanks, and MarketWatch disabled even if keys are present", async () => {
    vi.stubEnv("SEEKING_ALPHA_API_KEY", "secret");
    vi.stubEnv("TIPRANKS_API_KEY", "secret");
    vi.stubEnv("MARKETWATCH_API_KEY", "secret");
    const stubs = [createSeekingAlphaStub(), createTipRanksStub(), createMarketWatchStub()];
    for (const stub of stubs) {
      expect(stub.configured).toBe(false);
      await expect(stub.getQuote?.("NVDA")).rejects.toThrow(/disabled/i);
    }
    const providers = buildProviders({ SEEKING_ALPHA_API_KEY: "x", TIPRANKS_API_KEY: "x", MARKETWATCH_API_KEY: "x" } as NodeJS.ProcessEnv);
    expect(providers.filter((p) => p.configured)).toHaveLength(0);
  });
});
