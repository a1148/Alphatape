import { describe, expect, it } from "vitest";
import { atr, indicatorsFromBars, macd, realizedVolPct, rsi, smaLast } from "./indicators";

describe("indicators", () => {
  it("computes SMA exactly", () => {
    expect(smaLast([1, 2, 3, 4, 5], 5)).toBe(3);
    expect(smaLast([1, 2, 3, 4, 5], 2)).toBe(4.5);
    expect(smaLast([1, 2], 5)).toBeNull();
  });

  it("returns null RSI on a short series and extremes on monotonic series", () => {
    expect(rsi([1, 2, 3], 14)).toBeNull();
    const up = Array.from({ length: 40 }, (_, i) => 100 + i);
    const down = Array.from({ length: 40 }, (_, i) => 100 - i);
    expect(rsi(up, 14)!).toBeGreaterThan(90);
    expect(rsi(down, 14)!).toBeLessThan(10);
    expect(rsi(Array.from({ length: 30 }, () => 50), 14)).toBe(50);
  });

  it("returns a MACD line on a long uptrend", () => {
    const closes = Array.from({ length: 80 }, (_, i) => 50 + i * 0.4);
    const value = macd(closes);
    expect(value).not.toBeNull();
    expect(value!.macd).toBeGreaterThan(0);
    expect(value!.hist).toBeCloseTo(value!.macd - value!.signal);
  });

  it("derives indicators only when the series is long enough", () => {
    const bars = Array.from({ length: 220 }, (_, i) => ({
      date: `2025-01-${String((i % 28) + 1).padStart(2, "0")}`,
      open: 10 + i * 0.05,
      high: 10.2 + i * 0.05,
      low: 9.8 + i * 0.05,
      close: 10.1 + i * 0.05,
      volume: 1_000_000 + i * 1000,
    }));
    const ind = indicatorsFromBars(bars);
    expect(ind.sma200).not.toBeNull();
    expect(ind.rsi14).not.toBeNull();
    expect(ind.high52w).toBeGreaterThan(ind.low52w!);
    expect(realizedVolPct(bars.map((b) => b.close))).not.toBeNull();
    expect(atr(bars, 14)).toBeGreaterThan(0);
  });
});
