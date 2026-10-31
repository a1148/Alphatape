# Market-data providers

Adapters sit behind one interface. A provider is constructed only as configured when its key is present. Empty responses stay null. The hub tries the next configured provider. It does not copy a demo number into a live field.

| Provider | Turns on when | Quotes | Fundamentals | Analyst | Insiders | News | Bars | Indicators | TASE |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Polygon | `POLYGON_API_KEY` | yes | | | | | yes | | none — `.TA` is not requested |
| Finnhub | `FINNHUB_API_KEY` | yes | | yes | yes | yes | | | partial — `TEVA.TA` style symbols, free tier is thin |
| Financial Modeling Prep | `FMP_API_KEY` | yes | yes | yes | yes | | | | partial — `TICKER.TA` |
| Twelve Data | `TWELVE_DATA_API_KEY` | yes | | | | | yes | RSI, MACD, SMA | yes — `symbol=TEVA&exchange=TASE` |
| Alpha Vantage | `ALPHAVANTAGE_API_KEY` | yes | | | | | yes | RSI only, to spare the free quota | partial — `SYMBOL.TA`, often empty on the free tier (about 25 calls/day) |
| Yahoo Finance (`yahoo-finance2`) | `YAHOO_UNOFFICIAL_ENABLED=true` | yes | P/E and market cap only | | | | yes | | partial — `TEVA.TA`. Unofficial. Source id `yahoo-unofficial` |
| Seeking Alpha | never | | | | | | | | stub |
| TipRanks | never | | | | | | | | stub |
| MarketWatch | never | | | | | | | | stub |

## Free tiers

- Finnhub: https://finnhub.io/register
- FMP: https://site.financialmodelingprep.com/developer/docs
- Polygon: https://polygon.io/dashboard/signup
- Twelve Data: https://twelvedata.com/pricing
- Alpha Vantage: https://www.alphavantage.co/support/#api-key

Outbound calls use a per-provider token bucket, three retries with exponential backoff on 429 and 5xx, and a circuit breaker that opens after 5 failures for 60 seconds. Alpha Vantage is paced at about one call every 13 seconds.

## Stubs

Seeking Alpha, TipRanks, and MarketWatch have no public official API that this app calls. The adapters stay disabled even if `SEEKING_ALPHA_API_KEY`, `TIPRANKS_API_KEY`, or `MARKETWATCH_API_KEY` is set. Nothing is scraped. A commercial license (TipRanks or Seeking Alpha via a licensed RapidAPI product, or a Dow Jones license for MarketWatch) means replacing the stub.

## TASE

Universe symbols that end in `.TA` (for example `TEVA.TA`, `LUMI.TA`, `ICL.TA`) are Tel Aviv listings, priced in ILS in demo mode, and are not FX-converted against the US line. Polygon is skipped. Twelve Data is the intended live source. The others are best-effort and return null on a miss.

## Dividends

`GET /api/v1/dividends` screens the candidate universe. A name passes only when the stored annual series computes to at least 10 consecutive years with a dividend above zero and both 5-year and 10-year year-end price CAGR of at least 5%. The response is the top 15 passing names by the stability score. Candidates that fail are returned under `rejected` with the gate that failed. Past CAGR is labeled as history, not a forecast.

In live mode, FMP's dividends endpoint can replace demo dividend amounts (`source: fmp`). That payload has amounts, not year-end closes, so price CAGR stays N/A until closes are stored and the name drops off the board instead of keeping the demo path.

## Live refresh

With `DATA_MODE=auto`, any configured quote provider switches the worker out of the demo random walk. The first live pass replaces demo snapshot numbers. A field the provider did not return is left null and shown as N/A. Restarting the API does not re-seed over rows already marked `live` unless `SEED_OVERWRITE=true`.

Quote order: Polygon, Finnhub, Twelve Data, Alpha Vantage, Yahoo unofficial. Fundamentals: FMP, then Yahoo P/E and market cap. Analyst and insiders: Finnhub, then FMP. News: Finnhub. Bars: Polygon, Twelve Data, Alpha Vantage, Yahoo. Daily RSI, MACD, and moving averages are recomputed from those bars and labeled `computed:<provider>`.
