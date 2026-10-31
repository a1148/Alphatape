import { createAlphaVantage } from "./alphavantage";
import { createFinnhub } from "./finnhub";
import { createFmp } from "./fmp";
import { ProviderHub } from "./hub";
import { createPolygon } from "./polygon";
import { createMarketWatchStub, createSeekingAlphaStub, createTipRanksStub } from "./stubs";
import { createTwelve } from "./twelve";
import type { MarketDataProvider } from "./types";
import { createYahoo } from "./yahoo";

export function buildProviders(env: NodeJS.ProcessEnv = process.env): MarketDataProvider[] {
  return [
    createPolygon(env),
    createFinnhub(env),
    createFmp(env),
    createTwelve(env),
    createAlphaVantage(env),
    createYahoo(env),
    createSeekingAlphaStub(),
    createTipRanksStub(),
    createMarketWatchStub(),
  ];
}

export function hasLiveMarketProvider(env: NodeJS.ProcessEnv = process.env): boolean {
  return buildProviders(env).some((provider) => provider.configured && provider.capabilities.quotes);
}

export function createHub(env: NodeJS.ProcessEnv = process.env, log?: ConstructorParameters<typeof ProviderHub>[1]): ProviderHub {
  return new ProviderHub(buildProviders(env), log);
}

export * from "./types";
export * from "./symbols";
export * from "./hub";
export * from "./circuit";
export * from "./retry";
export * from "./rate-limit";
export { parseFinnhubQuote, parseFinnhubRecommendations, parseFinnhubInsiders, parseFinnhubNews } from "./finnhub";
export { parseFmpQuote, parseFmpFundamentals } from "./fmp";
export { parsePolygonSnapshot, parsePolygonAggs } from "./polygon";
export { parseTwelveQuote } from "./twelve";
export { parseAlphaQuote } from "./alphavantage";
export { mapYahooQuote } from "./yahoo";
