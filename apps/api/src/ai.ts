import { createHash } from "node:crypto";
import { prisma } from "@alphatape/db";
import type { StockRow } from "@alphatape/shared";
import { redis } from "./redis";

export interface AiPayload {
  enabled: true;
  modelEstimate: true;
  cached: boolean;
  model: string;
  summary: string;
  why: string;
  risk: string;
  bull: string;
  bear: string;
  outlook3m: string;
  outlook1y: string;
  createdAt: string;
}

const KEYS = ["summary", "why", "risk", "bull", "bear", "outlook3m", "outlook1y"] as const;

function snapshotForPrompt(row: StockRow) {
  const pick = <T>(sourced: { value: T | null; source: string | null; asOf: string | null }) => ({
    value: sourced.value,
    source: sourced.source,
    asOf: sourced.asOf,
  });
  return {
    symbol: row.symbol,
    name: row.name,
    exchange: row.exchange,
    currency: row.currency,
    sector: row.sector,
    industry: row.industry,
    description: row.description,
    dataMode: row.dataMode,
    price: pick(row.price),
    changePercent: pick(row.changePercent),
    marketCap: pick(row.marketCap),
    pe: pick(row.pe),
    revenueGrowth: pick(row.revenueGrowth),
    epsGrowth: pick(row.epsGrowth),
    shortInterest: pick(row.shortInterest),
    institutionalOwnership: pick(row.institutionalOwnership),
    insiderNetValue: pick(row.insiderNetValue),
    insiderBuys: pick(row.insiderBuys),
    insiderSells: pick(row.insiderSells),
    consensus: pick(row.consensus),
    analystCount: pick(row.analystCount),
    strongBuy: pick(row.strongBuy),
    buy: pick(row.buy),
    hold: pick(row.hold),
    sell: pick(row.sell),
    strongSell: pick(row.strongSell),
    targetMean: pick(row.targetMean),
    upside: pick(row.upside),
    revisionTrend: pick(row.revisionTrend),
    rsi14: pick(row.rsi14),
    macdHist: pick(row.macdHist),
    sma50: pick(row.sma50),
    sma200: pick(row.sma200),
    volatility: pick(row.volatility),
    score: { value: row.score.score, confidence: row.score.confidence, modelId: row.score.modelId, note: row.score.note },
    risk: row.score.risk,
    breakout: row.breakout,
    themes: row.themes,
  };
}

export async function generateAnalysis(row: StockRow, locale: "he" | "en", force = false): Promise<AiPayload | { enabled: false; reason: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return { enabled: false, reason: "OPENAI_API_KEY is not set. AI write-ups stay disabled. No text is invented in their place." };
  }
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const base = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const payload = snapshotForPrompt(row);
  const promptHash = createHash("sha256").update(JSON.stringify({ payload, locale, model })).digest("hex");
  if (!force) {
    const cached = await prisma.aiAnalysis.findUnique({ where: { symbol_locale_promptHash: { symbol: row.symbol, locale, promptHash } } });
    if (cached) {
      return {
        enabled: true,
        modelEstimate: true,
        cached: true,
        model: cached.model,
        summary: cached.summary,
        why: cached.why,
        risk: cached.risk,
        bull: cached.bull,
        bear: cached.bear,
        outlook3m: cached.outlook3m,
        outlook1y: cached.outlook1y,
        createdAt: cached.createdAt.toISOString(),
      };
    }
  }

  const language = locale === "he" ? "Hebrew" : "English";
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You write research notes for AlphaTape. Use ONLY the JSON payload. Never invent prices, ratings, targets, growth rates, or news. If a value is null, say the figure is unavailable. Frame 3-month and 1-year text as scenarios with uncertainty, not forecasts or recommendations. State that this is a model estimate and not investment advice. Respond in ${language}. Return JSON with keys summary, why, risk, bull, bear, outlook3m, outlook1y. Do not include numeric ranges unless both price and targetMean are non-null in the payload.`,
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM HTTP ${response.status}: ${text.slice(0, 240)}`);
  }
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("LLM returned an empty body");
  const parsed = JSON.parse(content) as Record<string, unknown>;
  for (const key of KEYS) {
    if (typeof parsed[key] !== "string" || !parsed[key]) throw new Error(`LLM response missing ${key}`);
  }
  const saved = await prisma.aiAnalysis.upsert({
    where: { symbol_locale_promptHash: { symbol: row.symbol, locale, promptHash } },
    update: {
      summary: parsed.summary as string,
      why: parsed.why as string,
      risk: parsed.risk as string,
      bull: parsed.bull as string,
      bear: parsed.bear as string,
      outlook3m: parsed.outlook3m as string,
      outlook1y: parsed.outlook1y as string,
      model,
    },
    create: {
      symbol: row.symbol,
      locale,
      promptHash,
      summary: parsed.summary as string,
      why: parsed.why as string,
      risk: parsed.risk as string,
      bull: parsed.bull as string,
      bear: parsed.bear as string,
      outlook3m: parsed.outlook3m as string,
      outlook1y: parsed.outlook1y as string,
      model,
    },
  });
  return {
    enabled: true,
    modelEstimate: true,
    cached: false,
    model: saved.model,
    summary: saved.summary,
    why: saved.why,
    risk: saved.risk,
    bull: saved.bull,
    bear: saved.bear,
    outlook3m: saved.outlook3m,
    outlook1y: saved.outlook1y,
    createdAt: saved.createdAt.toISOString(),
  };
}

export async function allowAiCall(bucket: string): Promise<boolean> {
  if (!redis || redis.status !== "ready") return true;
  try {
    const key = `ai:${bucket}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, 3600);
    return count <= 20;
  } catch {
    return true;
  }
}
