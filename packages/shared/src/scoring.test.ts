import { describe, expect, it } from "vitest";
import { computeScore, computeUpside, consensusFromCounts, emptyScoreInput, piecewise, DEFAULT_WEIGHTS } from "./scoring";

describe("scoring engine", () => {
  it("maps upside of 30% to 80 and does not treat missing components as zero", () => {
    const input = emptyScoreInput();
    input.price = 100;
    input.targetMean = 130;
    const result = computeScore(input);
    expect(computeUpside(100, 130)).toBeCloseTo(30);
    expect(result.score).toBe(80);
    expect(result.renormalized).toBe(true);
    expect(result.components.find((c) => c.key === "consensus")?.score).toBeNull();
    expect(result.modelEstimate).toBe(true);
    expect(result.confidence).toBeLessThan(40);
  });

  it("scores a lone strong-buy rating at 100", () => {
    const input = emptyScoreInput();
    input.strongBuy = 1;
    input.analystCount = 1;
    const result = computeScore(input, { consensus: 1, coverage: 0, upside: 0, revisions: 0, revenueGrowth: 0, epsGrowth: 0, technicals: 0, insider: 0, institutional: 0, shortInterest: 0, risk: 0 });
    expect(result.score).toBe(100);
    expect(consensusFromCounts(input)).toBe("strong_buy");
  });

  it("returns a null score when every component is missing", () => {
    const result = computeScore(emptyScoreInput());
    expect(result.score).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.risk.rating).toBeNull();
  });

  it("peaks RSI technicals near 60", () => {
    const input = emptyScoreInput();
    input.rsi14 = 60;
    const result = computeScore(input, { technicals: 1, consensus: 0, coverage: 0, upside: 0, revisions: 0, revenueGrowth: 0, epsGrowth: 0, insider: 0, institutional: 0, shortInterest: 0, risk: 0 });
    expect(piecewise(60, [[55, 92], [65, 88]])).toBe(90);
    expect(result.score).toBe(90);
  });

  it("gives a weak tape a low score", () => {
    const input = emptyScoreInput();
    input.price = 10;
    input.targetMean = 6;
    input.revenueGrowth = -20;
    input.epsGrowth = -30;
    input.strongBuy = 0;
    input.buy = 0;
    input.hold = 1;
    input.sell = 4;
    input.strongSell = 8;
    input.analystCount = 13;
    input.revisionTrend = -1;
    input.rsi14 = 85;
    input.macdHist = -1;
    input.sma50 = 14;
    input.sma200 = 16;
    input.insiderNetValue = -1_000_000;
    input.institutionalOwnership = 5;
    input.shortInterest = 30;
    input.volatility = 80;
    input.marketCap = 200_000_000;
    input.themes = ["biotech"];
    const result = computeScore(input);
    expect(result.score).not.toBeNull();
    expect(result.score!).toBeLessThan(40);
    expect(result.risk.rating === "high" || result.risk.rating === "very_high").toBe(true);
  });

  it("gives a complete strong profile a high score and higher confidence", () => {
    const input = emptyScoreInput();
    input.price = 100;
    input.targetMean = 150;
    input.revenueGrowth = 40;
    input.epsGrowth = 50;
    input.strongBuy = 20;
    input.buy = 8;
    input.hold = 2;
    input.sell = 0;
    input.strongSell = 0;
    input.analystCount = 30;
    input.consensus = "strong_buy";
    input.revisionTrend = 0.8;
    input.rsi14 = 60;
    input.macdHist = 1.2;
    input.sma50 = 90;
    input.sma200 = 70;
    input.insiderNetValue = 2_000_000;
    input.insiderBuys = 4;
    input.insiderSells = 1;
    input.institutionalOwnership = 60;
    input.shortInterest = 2;
    input.volatility = 22;
    input.marketCap = 50_000_000_000;
    const result = computeScore(input);
    expect(result.score).toBeGreaterThan(80);
    expect(result.confidence).toBeGreaterThan(80);
    expect(result.renormalized).toBe(false);
  });
});
