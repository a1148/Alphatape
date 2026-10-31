import type { BreakoutResult } from "./types";

export interface BreakoutInput {
  price: number | null;
  high52w: number | null;
  volume: number | null;
  avgVolume: number | null;
  atrContraction: number | null;
  sma50: number | null;
  sma200: number | null;
}

export function detectBreakout(input: BreakoutInput): BreakoutResult {
  const reasons: string[] = [];
  const missing: string[] = [];
  let distanceToHighPct: number | null = null;

  if (input.price != null && input.high52w != null && input.high52w > 0) {
    distanceToHighPct = ((input.high52w - input.price) / input.high52w) * 100;
    if (distanceToHighPct <= 3 && distanceToHighPct >= -1) reasons.push("near_52w_high");
  } else missing.push("high52w");

  if (input.volume != null && input.avgVolume != null && input.avgVolume > 0) {
    if (input.volume >= input.avgVolume * 1.5) reasons.push("volume_expansion");
  } else missing.push("volume");

  if (input.atrContraction != null) {
    if (input.atrContraction <= 0.8) reasons.push("volatility_contraction");
  } else missing.push("atr");

  if (input.price != null && input.sma50 != null) {
    if (input.price > input.sma50) reasons.push("above_sma50");
  } else missing.push("sma50");

  if (input.price != null && input.sma200 != null) {
    if (input.price > input.sma200) reasons.push("above_sma200");
  } else missing.push("sma200");

  const nearHigh = reasons.includes("near_52w_high");
  const confirmations = reasons.filter((r) => r !== "near_52w_high");
  let status: BreakoutResult["status"] = "none";
  if (input.price == null || input.high52w == null) status = "insufficient_data";
  else if (nearHigh && confirmations.includes("volume_expansion") && confirmations.length >= 2) status = "breakout";
  else if (nearHigh && confirmations.length >= 1) status = "pre_breakout";
  else status = "none";

  return { status, reasons, missing, distanceToHighPct };
}
