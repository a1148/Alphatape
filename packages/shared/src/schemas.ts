import { z } from "zod";
import { WEIGHT_KEYS } from "./scoring";

export const registerSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  name: z.string().trim().min(1).max(80),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
});

export const alertSchema = z.object({
  symbol: z.string().trim().min(1).max(24),
  kind: z.enum(["price_above", "price_below", "score_above", "score_below", "change_pct_above"]),
  threshold: z.number().finite(),
});

export const alertPatchSchema = z.object({
  enabled: z.boolean().optional(),
  threshold: z.number().finite().optional(),
});

export const watchlistSchema = z.object({
  symbol: z.string().trim().min(1).max(24),
});

const weightValue = z.number().finite().min(0).max(100);
export const weightsSchema = z.object(
  Object.fromEntries(WEIGHT_KEYS.map((key) => [key, weightValue.optional()])) as Record<(typeof WEIGHT_KEYS)[number], z.ZodOptional<typeof weightValue>>,
);

export const aiRequestSchema = z.object({
  locale: z.enum(["he", "en"]).default("he"),
  force: z.boolean().optional(),
});

export const stockQuerySchema = z.object({
  q: z.string().trim().max(64).optional(),
  strongBuy: z.enum(["true", "false"]).optional(),
  breakout: z.enum(["true", "false"]).optional(),
  minUpside: z.coerce.number().optional(),
  maxUpside: z.coerce.number().optional(),
  minMarketCap: z.coerce.number().optional(),
  maxMarketCap: z.coerce.number().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  rsiMin: z.coerce.number().optional(),
  rsiMax: z.coerce.number().optional(),
  minAnalysts: z.coerce.number().optional(),
  minConfidence: z.coerce.number().optional(),
  sector: z.string().trim().max(80).optional(),
  theme: z.string().trim().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export function matchesQuery(row: {
  symbol: string;
  name: string;
  nameHe: string | null;
  sector: string;
  industry: string;
  price: { value: number | null };
  marketCap: { value: number | null };
  upside: { value: number | null };
  rsi14: { value: number | null };
  analystCount: { value: number | null };
  consensus: { value: string | null };
  score: { confidence: number | null };
  breakout: { status: string };
  themes: { id: string }[];
}, query: z.infer<typeof stockQuerySchema>): boolean {
  if (query.q) {
    const q = query.q.toLowerCase();
    const blob = `${row.symbol} ${row.name} ${row.nameHe ?? ""} ${row.sector} ${row.industry}`.toLowerCase();
    if (!blob.includes(q)) return false;
  }
  if (query.strongBuy === "true" && row.consensus.value !== "strong_buy") return false;
  if (query.breakout === "true" && row.breakout.status !== "breakout" && row.breakout.status !== "pre_breakout") return false;
  if (query.minUpside != null && (row.upside.value == null || row.upside.value < query.minUpside)) return false;
  if (query.maxUpside != null && (row.upside.value == null || row.upside.value > query.maxUpside)) return false;
  if (query.minMarketCap != null && (row.marketCap.value == null || row.marketCap.value < query.minMarketCap)) return false;
  if (query.maxMarketCap != null && (row.marketCap.value == null || row.marketCap.value > query.maxMarketCap)) return false;
  if (query.minPrice != null && (row.price.value == null || row.price.value < query.minPrice)) return false;
  if (query.maxPrice != null && (row.price.value == null || row.price.value > query.maxPrice)) return false;
  if (query.rsiMin != null && (row.rsi14.value == null || row.rsi14.value < query.rsiMin)) return false;
  if (query.rsiMax != null && (row.rsi14.value == null || row.rsi14.value > query.rsiMax)) return false;
  if (query.minAnalysts != null && (row.analystCount.value == null || row.analystCount.value < query.minAnalysts)) return false;
  if (query.minConfidence != null && (row.score.confidence == null || row.score.confidence < query.minConfidence)) return false;
  if (query.sector && row.sector !== query.sector) return false;
  if (query.theme && !row.themes.some((t) => t.id === query.theme)) return false;
  return true;
}
