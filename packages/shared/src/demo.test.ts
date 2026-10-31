import { describe, expect, it } from "vitest";
import { generateDemoDataset } from "./demo";
import { indicatorsFromBars } from "./indicators";
import { presentStock } from "./present";
import { HOT_UNIVERSE } from "./universe";

describe("demo dataset", () => {
  const data = generateDemoDataset();

  it("covers 30 hot names and labels every market figure as demo", () => {
    expect(HOT_UNIVERSE).toHaveLength(30);
    expect(data.stocks.filter((stock) => data.lists[stock.symbol]?.includes("hot"))).toHaveLength(30);
    for (const stock of data.stocks) {
      expect(stock.dataMode).toBe("demo");
      expect(stock.provenance.price?.source).toBe("computed:demo-bars");
      expect(stock.provenance.price?.note?.toLowerCase()).toContain("synthetic");
      if (stock.pe != null) expect(stock.provenance.pe?.source).toBe("demo");
      if (stock.revenueGrowth == null) expect(stock.provenance.revenueGrowth).toBeUndefined();
    }
  });

  it("keeps price, technicals, and 52-week high consistent with the bar series", () => {
    const nvdaBars = data.bars.filter((b) => b.symbol === "NVDA");
    const ind = indicatorsFromBars(nvdaBars);
    const nvda = data.stocks.find((s) => s.symbol === "NVDA")!;
    expect(nvda.price).toBe(ind.last?.close);
    expect(nvda.rsi14).toBe(ind.rsi14);
    expect(nvda.sma50).toBe(ind.sma50);
    expect(nvda.high52w).toBe(ind.high52w);
    expect(nvdaBars.every((b) => b.isDemo && b.source === "demo")).toBe(true);
  });

  it("withholds fields that were intentionally left empty and flags breakouts only from the series", () => {
    const presented = data.stocks.map((s) => presentStock(s));
    const icl = presented.find((s) => s.symbol === "ICL.TA")!;
    expect(icl.upside.value).toBeNull();
    expect(icl.consensus.value).toBeNull();
    expect(icl.targetMean.value).toBeNull();
    const jnj = presented.find((s) => s.symbol === "JNJ")!;
    expect(jnj.shortInterest.value).toBeNull();
    expect(jnj.institutionalOwnership.value).toBeNull();
    expect(jnj.targetMean.value).toBeNull();
    const nvda = presented.find((s) => s.symbol === "NVDA")!;
    expect(nvda.breakout.status === "breakout" || nvda.breakout.status === "pre_breakout").toBe(true);
    expect(nvda.score.modelEstimate).toBe(true);
    expect(nvda.score.score).not.toBeNull();
    const intel = presented.find((s) => s.symbol === "INTC")!;
    expect(intel.breakout.status).toBe("none");
    expect(data.news.every((n) => n.headline.startsWith("[DEMO]") && n.isDemo)).toBe(true);
  });

  it("hides a stored number that has no provenance", () => {
    const raw = structuredClone(data.stocks[0]);
    raw.pe = 99;
    delete raw.provenance.pe;
    const row = presentStock(raw);
    expect(row.pe.value).toBeNull();
    expect(row.pe.note).toBe("withheld_missing_provenance");
  });
});
