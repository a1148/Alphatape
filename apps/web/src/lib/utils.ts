import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function tvSymbol(symbol: string, exchange: string) {
  if (symbol.endsWith(".TA")) return `TASE:${symbol.replace(/\.TA$/, "")}`;
  if (exchange === "NYSE") return `NYSE:${symbol}`;
  if (exchange === "TASE") return `TASE:${symbol}`;
  return `NASDAQ:${symbol}`;
}
