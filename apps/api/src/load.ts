import { prisma } from "@alphatape/db";
import { matchesQuery, presentStock, stockQuerySchema, type StockRow, type Weights } from "@alphatape/shared";
import type { z } from "zod";
import { toRaw } from "./map";

export async function loadRows(weights: Weights): Promise<StockRow[]> {
  const [stocks, snaps] = await Promise.all([
    prisma.stock.findMany({ where: { active: true, lists: { has: "hot" } }, orderBy: { symbol: "asc" } }),
    prisma.marketSnapshot.findMany(),
  ]);
  const bySymbol = new Map(snaps.map((snap) => [snap.symbol, snap]));
  return stocks.map((stock) => presentStock(toRaw(stock, bySymbol.get(stock.symbol) ?? null), weights));
}

export function filterRows(rows: StockRow[], query: z.infer<typeof stockQuerySchema>): StockRow[] {
  const matched = rows.filter((row) => matchesQuery(row, query));
  matched.sort((a, b) => (b.score.score ?? -1) - (a.score.score ?? -1));
  return query.limit ? matched.slice(0, query.limit) : matched;
}
