import { describe, expect, it } from "vitest";
import { DIVIDEND_CANDIDATES } from "./dividend-universe";
import { assessDividend, buildAnnualSeries, cagrPct, rankDividendBoard } from "./dividends";
import { HOT_UNIVERSE } from "./universe";

function fromSpec(spec: (typeof DIVIDEND_CANDIDATES)[number]) {
  const points = buildAnnualSeries({
    endClose: spec.endClose,
    yieldPct: spec.yieldPct,
    priceCagr: spec.priceCagr,
    divCagr: spec.divCagr,
    firstYear: spec.firstYear,
    zeroDividendYears: spec.zeroDividendYears,
  });
  const latest = points.at(-1)!;
  const eps = spec.payout && latest.dividendPerShare ? latest.dividendPerShare / spec.payout : null;
  return assessDividend({
    points,
    price: spec.endClose,
    eps,
    beta: spec.beta,
    debtToEquity: spec.debtToEquity,
    interestCoverage: spec.interestCoverage,
  });
}

describe("dividend screen", () => {
  it("recomputes a constant growth path instead of trusting the input label", () => {
    const points = buildAnnualSeries({ endClose: 200, yieldPct: 2, priceCagr: 0.08, divCagr: 0.05 });
    const result = assessDividend({ points, price: 200, eps: 8, beta: 0.5, debtToEquity: 0.4, interestCoverage: 12 });
    expect(cagrPct(points[0].close, points.at(-1)!.close, 10)).toBeCloseTo(8, 1);
    expect(result.priceCagr5Pct).toBeCloseTo(8, 1);
    expect(result.priceCagr10Pct).toBeCloseTo(8, 1);
    expect(result.consecutiveYears).toBe(11);
    expect(result.passes).toBe(true);
    expect(result.stability.modelEstimate).toBe(true);
  });

  it("does not treat a missing beta as zero", () => {
    const points = buildAnnualSeries({ endClose: 100, yieldPct: 2, priceCagr: 0.08, divCagr: 0.05 });
    const full = assessDividend({ points, price: 100, eps: 4, beta: 0.5, debtToEquity: 0.4, interestCoverage: 12 });
    const missing = assessDividend({ points, price: 100, eps: 4, beta: null, debtToEquity: 0.4, interestCoverage: 12 });
    expect(missing.stability.components.find((item) => item.key === "beta")?.score).toBeNull();
    expect(missing.stability.renormalized).toBe(true);
    expect(missing.stability.score).not.toBeNull();
    expect(missing.stability.score).toBeGreaterThan(70);
    expect(full.stability.score).not.toBe(missing.stability.score);
  });

  it("fails a broken dividend streak and a sub-5% price path", () => {
    const cut = assessDividend({
      points: buildAnnualSeries({ endClose: 100, yieldPct: 3, priceCagr: 0.09, divCagr: 0.04, zeroDividendYears: [2020] }),
      price: 100, eps: 6, beta: 0.8, debtToEquity: 0.3, interestCoverage: 10,
    });
    expect(cut.passes).toBe(false);
    expect(cut.failReasons).toContain("consecutive_years");
    expect(cut.consecutiveYears).toBe(5);

    const flat = assessDividend({
      points: buildAnnualSeries({ endClose: 40, yieldPct: 6, priceCagr: 0.02, divCagr: 0.02 }),
      price: 40, eps: 4, beta: 0.4, debtToEquity: 1.5, interestCoverage: 5,
    });
    expect(flat.passes).toBe(false);
    expect(flat.failReasons).toContain("price_cagr_5y");
    expect(flat.failReasons).toContain("price_cagr_10y");
  });

  it("keeps the hot universe at 30 and ranks a passing dividend board of 15", () => {
    expect(HOT_UNIVERSE).toHaveLength(30);
    const assessed = DIVIDEND_CANDIDATES.map((spec) => ({ symbol: spec.symbol, assessment: fromSpec(spec) }));
    const { board, rejected } = rankDividendBoard(assessed);
    expect(board).toHaveLength(15);
    expect(board.every((row) => row.assessment.passes && (row.assessment.priceCagr5Pct ?? 0) >= 5 && (row.assessment.consecutiveYears ?? 0) >= 10)).toBe(true);
    for (const symbol of ["T", "VZ", "INTC", "POLI.TA", "XOM"]) {
      expect(board.some((row) => row.symbol === symbol)).toBe(false);
      expect(rejected.find((row) => row.symbol === symbol)?.assessment.passes).toBe(false);
    }
    expect(assessed.filter((row) => row.assessment.passes).length).toBeGreaterThan(15);
  });
});
