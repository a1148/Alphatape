import type { BarPoint } from "./types";

export function roundTo(n: number, digits = 2): number {
  const p = 10 ** digits;
  return Math.round(n * p) / p;
}

export function smaLast(values: number[], period: number): number | null {
  if (values.length < period || period <= 0) return null;
  let sum = 0;
  for (let i = values.length - period; i < values.length; i++) sum += values[i];
  return sum / period;
}

/** Wilder RSI. Flat series (no gains and no losses) returns 50. */
export function rsi(closes: number[], period = 14): number | null {
  if (closes.length < period + 1 || period <= 0) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
  }
  if (avgGain === 0 && avgLoss === 0) return 50;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function emaSeries(values: number[], period: number): number[] | null {
  if (values.length < period || period <= 0) return null;
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = 0;
  for (let i = 0; i < period; i++) prev += values[i];
  prev /= period;
  for (let i = 0; i < period - 1; i++) out.push(Number.NaN);
  out.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function macd(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): { macd: number; signal: number; hist: number } | null {
  if (closes.length < slow + signalPeriod) return null;
  const fastE = emaSeries(closes, fast);
  const slowE = emaSeries(closes, slow);
  if (!fastE || !slowE) return null;
  const line: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (Number.isNaN(fastE[i]) || Number.isNaN(slowE[i])) continue;
    line.push(fastE[i] - slowE[i]);
  }
  const signalE = emaSeries(line, signalPeriod);
  if (!signalE) return null;
  const last = signalE.length - 1;
  if (Number.isNaN(signalE[last])) return null;
  const macdLine = line[line.length - 1];
  const signal = signalE[last];
  return { macd: macdLine, signal, hist: macdLine - signal };
}

export function realizedVolPct(closes: number[]): number | null {
  if (closes.length < 21) return null;
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] <= 0 || closes[i] <= 0) continue;
    rets.push(Math.log(closes[i] / closes[i - 1]));
  }
  if (rets.length < 20) return null;
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

export function atr(
  bars: { high: number; low: number; close: number }[],
  period = 14,
): number | null {
  if (bars.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].high;
    const l = bars[i].low;
    const pc = bars[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  if (trs.length < period) return null;
  let a = 0;
  for (let i = 0; i < period; i++) a += trs[i];
  a /= period;
  for (let i = period; i < trs.length; i++) a = (a * (period - 1) + trs[i]) / period;
  return a;
}

/** Recent 14-period ATR divided by the prior window's ATR. Below 1 means contraction. */
export function atrContractionRatio(
  bars: { high: number; low: number; close: number }[],
  period = 14,
): number | null {
  if (bars.length < period * 4) return null;
  const recent = atr(bars.slice(-(period * 2 + 1)), period);
  const prior = atr(bars.slice(-(period * 4 + 1), -(period * 2)), period);
  if (recent == null || prior == null || prior === 0) return null;
  return recent / prior;
}

export interface DerivedIndicators {
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  sma50: number | null;
  sma200: number | null;
  volatility: number | null;
  atrContraction: number | null;
  high52w: number | null;
  low52w: number | null;
  avgVolume20: number | null;
  last: BarPoint | null;
  prevClose: number | null;
}

export function indicatorsFromBars(bars: BarPoint[]): DerivedIndicators {
  const closes = bars.map((b) => b.close);
  const macdValue = macd(closes);
  const window = bars.slice(-252);
  const last = bars.length ? bars[bars.length - 1] : null;
  const prev = bars.length > 1 ? bars[bars.length - 2] : null;
  const volSlice = bars.slice(-21, -1);
  const avgVolume20 = volSlice.length
    ? volSlice.reduce((a, b) => a + b.volume, 0) / volSlice.length
    : null;
  return {
    rsi14: rsi(closes, 14),
    macd: macdValue?.macd ?? null,
    macdSignal: macdValue?.signal ?? null,
    macdHist: macdValue?.hist ?? null,
    sma50: smaLast(closes, 50),
    sma200: smaLast(closes, 200),
    volatility: realizedVolPct(closes),
    atrContraction: atrContractionRatio(bars, 14),
    high52w: window.length ? Math.max(...window.map((b) => b.high)) : null,
    low52w: window.length ? Math.min(...window.map((b) => b.low)) : null,
    avgVolume20,
    last,
    prevClose: prev?.close ?? null,
  };
}

export function businessDaysEnding(endIso: string, count: number): string[] {
  const end = new Date(endIso);
  const d = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  const days: string[] = [];
  while (days.length < count) {
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) days.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return days.reverse();
}
