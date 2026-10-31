export function isTaseSymbol(symbol: string): boolean {
  return /\.TA$/i.test(symbol) || /\.TASE$/i.test(symbol);
}

export function bareSymbol(symbol: string): string {
  return symbol.replace(/\.TA$/i, "").replace(/\.TASE$/i, "");
}

export function yahooSymbol(symbol: string): string {
  if (isTaseSymbol(symbol)) return `${bareSymbol(symbol)}.TA`;
  return symbol;
}
