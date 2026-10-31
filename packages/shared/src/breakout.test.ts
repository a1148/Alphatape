import { describe, expect, it } from "vitest";
import { detectBreakout } from "./breakout";

describe("breakout", () => {
  it("flags a breakout only when price is near the high and confirmations exist", () => {
    const result = detectBreakout({
      price: 99,
      high52w: 100,
      volume: 2_000_000,
      avgVolume: 1_000_000,
      atrContraction: 0.7,
      sma50: 90,
      sma200: 80,
    });
    expect(result.status).toBe("breakout");
    expect(result.reasons).toContain("near_52w_high");
    expect(result.reasons).toContain("volume_expansion");
  });

  it("does not invent a breakout when the 52-week high is missing", () => {
    const result = detectBreakout({
      price: 99,
      high52w: null,
      volume: 2_000_000,
      avgVolume: 1_000_000,
      atrContraction: 0.7,
      sma50: 90,
      sma200: 80,
    });
    expect(result.status).toBe("insufficient_data");
    expect(result.missing).toContain("high52w");
  });

  it("stays none when price is far from the high", () => {
    const result = detectBreakout({
      price: 70,
      high52w: 100,
      volume: 900_000,
      avgVolume: 1_000_000,
      atrContraction: 1.1,
      sma50: 80,
      sma200: 75,
    });
    expect(result.status).toBe("none");
  });
});
