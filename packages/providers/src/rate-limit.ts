/** Serial token bucket. minIntervalMs is the gap between grants. */
export class RateLimiter {
  private nextAt = 0;
  private chain: Promise<void> = Promise.resolve();

  constructor(private minIntervalMs: number) {}

  async take(): Promise<void> {
    const previous = this.chain;
    let release: () => void = () => undefined;
    this.chain = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const now = Date.now();
    const wait = Math.max(0, this.nextAt - now);
    this.nextAt = Math.max(this.nextAt, now) + this.minIntervalMs;
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    release();
  }
}

/** Conservative defaults aimed under published free-tier ceilings. */
export const PROVIDER_MIN_INTERVAL_MS: Record<string, number> = {
  finnhub: 1100,
  fmp: 1300,
  polygon: 1200,
  twelvedata: 1100,
  alphavantage: 13_000,
  "yahoo-unofficial": 2000,
};
