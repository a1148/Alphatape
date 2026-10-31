import type { MarketDataProvider } from "./types";
import { ProviderDisabledError } from "./types";

const EMPTY = {
  quotes: false, fundamentals: false, analyst: false, insiders: false, news: false, aggregates: false, indicators: false, websocket: false,
} as const;

function stub(spec: { id: string; displayName: string; envKey: string; docsUrl: string; blurb: string }): MarketDataProvider {
  const reason = `${spec.blurb} AlphaTape does not scrape this site. The adapter stays disabled even if ${spec.envKey} is set; a licensed client must replace this stub.`;
  const fail = () => {
    throw new ProviderDisabledError(spec.id, reason);
  };
  return {
    id: spec.id,
    displayName: spec.displayName,
    configured: false,
    disabledReason: reason,
    official: false,
    capabilities: { ...EMPTY },
    taseSupport: "none",
    taseNotes: "No implementation. A licensed feed would need to document TASE coverage itself.",
    docsUrl: spec.docsUrl,
    async getQuote() { return fail(); },
    async getFundamentals() { return fail(); },
    async getAnalyst() { return fail(); },
    async getNews() { return fail(); },
  };
}

export function createSeekingAlphaStub(): MarketDataProvider {
  return stub({
    id: "seekingalpha",
    displayName: "Seeking Alpha",
    envKey: "SEEKING_ALPHA_API_KEY",
    docsUrl: "https://seekingalpha.com",
    blurb: "Seeking Alpha has no public official API used by this app. A commercial license or a licensed RapidAPI product is required.",
  });
}

export function createTipRanksStub(): MarketDataProvider {
  return stub({
    id: "tipranks",
    displayName: "TipRanks",
    envKey: "TIPRANKS_API_KEY",
    docsUrl: "https://www.tipranks.com/developers",
    blurb: "TipRanks has no public official API enabled here. Use a TipRanks commercial license or a licensed RapidAPI product.",
  });
}

export function createMarketWatchStub(): MarketDataProvider {
  return stub({
    id: "marketwatch",
    displayName: "MarketWatch",
    envKey: "MARKETWATCH_API_KEY",
    docsUrl: "https://www.marketwatch.com",
    blurb: "MarketWatch has no public official API enabled here. A Dow Jones / MarketWatch data license is required.",
  });
}
