"use client";

import { useEffect, useRef } from "react";
import { ColorType, createChart } from "lightweight-charts";

export interface ChartBar { time: string; open: number; high: number; low: number; close: number; volume: number }

export function PriceChart({ bars }: { bars: ChartBar[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !bars.length) return;
    const chart = createChart(ref.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "#10161d" }, textColor: "#8ea0b3" },
      grid: { vertLines: { color: "#1c2631" }, horzLines: { color: "#1c2631" } },
      rightPriceScale: { borderColor: "#2a3848" },
      timeScale: { borderColor: "#2a3848" },
    });
    const candles = chart.addCandlestickSeries({ upColor: "#1fd68a", downColor: "#ff5d73", borderVisible: false, wickUpColor: "#1fd68a", wickDownColor: "#ff5d73" });
    candles.setData(bars.map((bar) => ({ time: bar.time, open: bar.open, high: bar.high, low: bar.low, close: bar.close })));
    const volume = chart.addHistogramSeries({ priceScaleId: "vol", priceFormat: { type: "volume" } });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });
    volume.setData(bars.map((bar) => ({ time: bar.time, value: bar.volume, color: bar.close >= bar.open ? "rgba(31,214,138,0.45)" : "rgba(255,93,115,0.45)" })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [bars]);
  return <div ref={ref} className="h-[360px] w-full" />;
}
