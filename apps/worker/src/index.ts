import http from "node:http";
import { prisma } from "@alphatape/db";
import { createHub, hasLiveMarketProvider } from "@alphatape/providers";
import { indicatorsFromBars, presentStock, type BarPoint, type ProvenanceMap } from "@alphatape/shared";
import { Redis } from "ioredis";
import nodemailer from "nodemailer";
import pino from "pino";
import client from "prom-client";
import { toRaw } from "../../api/src/map.ts";

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });
const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:63799/0");
const register = new client.Registry();
client.collectDefaultMetrics({ register });
const ticks = new client.Counter({ name: "alphatape_demo_ticks_total", help: "Demo quote ticks", registers: [register] });
const refreshes = new client.Counter({ name: "alphatape_provider_refresh_total", help: "Provider refresh attempts", labelNames: ["op", "result"], registers: [register] });

function demoMode() {
  if (process.env.DATA_MODE === "demo") return true;
  if (process.env.DATA_MODE === "live") return false;
  return !hasLiveMarketProvider();
}

function roundPrice(price: number) {
  const digits = Math.abs(price) >= 100 ? 2 : 4;
  const p = 10 ** digits;
  return Math.round(price * p) / p;
}

async function publish(message: unknown) {
  await redis.publish("tape", JSON.stringify(message));
}

async function maybeEmail(to: string, subject: string, text: string) {
  if (!process.env.SMTP_HOST) return;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS ?? "" } : undefined,
  });
  await transport.sendMail({ from: process.env.SMTP_FROM ?? process.env.SMTP_USER, to, subject, text });
}

async function evaluateAlerts() {
  const alerts = await prisma.alert.findMany({ where: { enabled: true }, include: { user: true } });
  if (!alerts.length) return;
  const symbols = [...new Set(alerts.map((alert) => alert.symbol))];
  const [stocks, snaps] = await Promise.all([
    prisma.stock.findMany({ where: { symbol: { in: symbols } } }),
    prisma.marketSnapshot.findMany({ where: { symbol: { in: symbols } } }),
  ]);
  const stockMap = new Map(stocks.map((stock) => [stock.symbol, stock]));
  const snapMap = new Map(snaps.map((snap) => [snap.symbol, snap]));
  const now = Date.now();
  for (const alert of alerts) {
    const stock = stockMap.get(alert.symbol);
    const snap = snapMap.get(alert.symbol);
    if (!stock || !snap) continue;
    const row = presentStock(toRaw(stock, snap));
    const price = row.price.value;
    const score = row.score.score;
    const change = row.changePercent.value;
    let hit = false;
    if (alert.kind === "price_above" && price != null && price >= alert.threshold) hit = true;
    if (alert.kind === "price_below" && price != null && price <= alert.threshold) hit = true;
    if (alert.kind === "score_above" && score != null && score >= alert.threshold) hit = true;
    if (alert.kind === "score_below" && score != null && score <= alert.threshold) hit = true;
    if (alert.kind === "change_pct_above" && change != null && change >= alert.threshold) hit = true;
    if (!hit) continue;
    if (alert.lastTriggeredAt && now - alert.lastTriggeredAt.getTime() < 30 * 60 * 1000) continue;
    const title = `${alert.symbol} alert`;
    const body = `${alert.kind} crossed ${alert.threshold}. Price ${price ?? "N/A"} (${row.price.source ?? "no source"}). AI score ${score ?? "N/A"} is a model estimate, not a guarantee.`;
    const note = await prisma.notification.create({ data: { userId: alert.userId, alertId: alert.id, title, body } });
    await prisma.alert.update({ where: { id: alert.id }, data: { lastTriggeredAt: new Date() } });
    await publish({ type: "alert", userId: alert.userId, notification: { id: note.id, title, body, createdAt: note.createdAt.toISOString() } });
    if (alert.user.email) {
      maybeEmail(alert.user.email, title, body).catch((error) => logger.warn({ err: error instanceof Error ? error.message : "smtp" }, "email skipped"));
    }
  }
}

async function demoTick() {
  const snaps = await prisma.marketSnapshot.findMany({ where: { dataMode: "demo" } });
  const asOf = new Date().toISOString();
  const items: Array<{ symbol: string; price: number; change: number | null; changePercent: number | null; volume: number | null; asOf: string; source: string }> = [];
  for (const snap of snaps) {
    if (snap.price == null || snap.prevClose == null) continue;
    const shock = (Math.random() - 0.5) * 0.003;
    const price = roundPrice(Math.max(0.01, snap.price * (1 + shock)));
    const change = price - snap.prevClose;
    const changePercent = snap.prevClose ? (change / snap.prevClose) * 100 : null;
    const volume = (snap.volume ?? 0) + Math.round((snap.avgVolume ?? 1000) * 0.01 * Math.random());
    const provenance = (snap.provenance && typeof snap.provenance === "object" && !Array.isArray(snap.provenance) ? { ...snap.provenance } : {}) as ProvenanceMap;
    const note = "Simulated random walk around the synthetic demo anchor. Not a market trade.";
    for (const key of ["price", "change", "changePercent", "volume", "high", "low"] as const) {
      provenance[key] = { source: "demo-simulator", asOf, note };
    }
    await prisma.marketSnapshot.update({
      where: { symbol: snap.symbol },
      data: { price, change, changePercent, volume, provenance, high: snap.high == null ? price : Math.max(snap.high, price), low: snap.low == null ? price : Math.min(snap.low, price) },
    });
    items.push({ symbol: snap.symbol, price, change, changePercent, volume, asOf, source: "demo-simulator" });
  }
  ticks.inc();
  await publish({ type: "quotes", demo: true, source: "demo-simulator", asOf, items });
}

function mergeProv(base: ProvenanceMap, key: string, source: string, asOf: string, note?: string | null): ProvenanceMap {
  return { ...base, [key]: { source, asOf, note: note ?? undefined } };
}

async function refreshQuotes() {
  const hub = createHub(process.env, { warn: (obj, msg) => logger.warn(obj, msg) });
  const stocks = await prisma.stock.findMany({ where: { active: true } });
  for (const stock of stocks) {
    const result = await hub.getQuote(stock.symbol);
    refreshes.inc({ op: "quote", result: result.value ? "ok" : "empty" });
    const existing = await prisma.marketSnapshot.findUnique({ where: { symbol: stock.symbol } });
    const wasDemo = !existing || existing.dataMode === "demo";
    if (!result.value) {
      if (wasDemo && process.env.DATA_MODE !== "demo") {
        await prisma.marketSnapshot.upsert({
          where: { symbol: stock.symbol },
          update: { price: null, change: null, changePercent: null, dataMode: "live", provenance: {} },
          create: { symbol: stock.symbol, dataMode: "live", provenance: {} },
        });
      }
      continue;
    }
    const quote = result.value;
    const provenance = wasDemo ? {} as ProvenanceMap : ((existing?.provenance && typeof existing.provenance === "object" && !Array.isArray(existing.provenance) ? existing.provenance : {}) as ProvenanceMap);
    let next = provenance;
    const fields = ["price", "change", "changePercent", "open", "high", "low", "prevClose", "volume"] as const;
    for (const key of fields) {
      const value = quote[key];
      if (typeof value === "number") next = mergeProv(next, key, quote.source, quote.asOf, quote.note);
    }
    await prisma.marketSnapshot.upsert({
      where: { symbol: stock.symbol },
      update: {
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        prevClose: quote.prevClose,
        volume: quote.volume,
        provenance: next,
        dataMode: "live",
      },
      create: {
        symbol: stock.symbol,
        price: quote.price,
        change: quote.change,
        changePercent: quote.changePercent,
        open: quote.open,
        high: quote.high,
        low: quote.low,
        prevClose: quote.prevClose,
        volume: quote.volume,
        provenance: next,
        dataMode: "live",
      },
    });
    await publish({
      type: "quotes",
      demo: false,
      source: quote.source,
      asOf: quote.asOf,
      items: [{ symbol: stock.symbol, price: quote.price, change: quote.change, changePercent: quote.changePercent, volume: quote.volume, asOf: quote.asOf, source: quote.source }],
    });
  }
}

async function refreshBars() {
  const hub = createHub(process.env, { warn: (obj, msg) => logger.warn(obj, msg) });
  const stocks = await prisma.stock.findMany({ where: { active: true } });
  for (const stock of stocks) {
    const result = await hub.getBars(stock.symbol);
    refreshes.inc({ op: "bars", result: result.value ? "ok" : "empty" });
    if (!result.value?.length) continue;
    const bars: BarPoint[] = result.value.map((bar) => ({ date: bar.date, open: bar.open, high: bar.high, low: bar.low, close: bar.close, volume: bar.volume }));
    await prisma.dailyBar.deleteMany({ where: { symbol: stock.symbol } });
    await prisma.dailyBar.createMany({
      data: bars.map((bar) => ({
        symbol: stock.symbol,
        date: new Date(`${bar.date}T00:00:00.000Z`),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        source: result.provider ?? "unknown",
        isDemo: false,
      })),
    });
    const ind = indicatorsFromBars(bars);
    const asOf = new Date().toISOString();
    const source = `computed:${result.provider}`;
    const note = `Derived from ${result.provider} daily bars.`;
    const existing = await prisma.marketSnapshot.findUnique({ where: { symbol: stock.symbol } });
    let provenance = (existing?.provenance && typeof existing.provenance === "object" && !Array.isArray(existing.provenance) ? existing.provenance : {}) as ProvenanceMap;
    const assign: Record<string, number | null> = {
      rsi14: ind.rsi14,
      macd: ind.macd,
      macdSignal: ind.macdSignal,
      macdHist: ind.macdHist,
      sma50: ind.sma50,
      sma200: ind.sma200,
      volatility: ind.volatility,
      atrContraction: ind.atrContraction,
      high52w: ind.high52w,
      low52w: ind.low52w,
      avgVolume: ind.avgVolume20,
    };
    for (const [key, value] of Object.entries(assign)) {
      if (value == null) continue;
      provenance = mergeProv(provenance, key, source, asOf, note);
    }
    await prisma.marketSnapshot.upsert({
      where: { symbol: stock.symbol },
      update: { ...assign, provenance, dataMode: "live" },
      create: { symbol: stock.symbol, ...assign, provenance, dataMode: "live" },
    });
  }
}

async function refreshFundamentals() {
  const hub = createHub(process.env, { warn: (obj, msg) => logger.warn(obj, msg) });
  const stocks = await prisma.stock.findMany({ where: { active: true } });
  for (const stock of stocks) {
    const [fund, analyst, insider] = await Promise.all([hub.getFundamentals(stock.symbol), hub.getAnalyst(stock.symbol), hub.getInsiders(stock.symbol)]);
    refreshes.inc({ op: "fundamentals", result: fund.value ? "ok" : "empty" });
    const existing = await prisma.marketSnapshot.findUnique({ where: { symbol: stock.symbol } });
    let provenance = (existing?.provenance && typeof existing.provenance === "object" && !Array.isArray(existing.provenance) ? existing.provenance : {}) as ProvenanceMap;
    const data: Record<string, number | string | null> = {};
    if (fund.value) {
      const asOf = fund.value.asOf;
      if (fund.value.pe != null) {
        data.pe = fund.value.pe;
        provenance = mergeProv(provenance, "pe", fund.value.source, asOf, fund.value.note);
      }
      if (fund.value.revenueGrowth != null) {
        data.revenueGrowth = fund.value.revenueGrowth;
        provenance = mergeProv(provenance, "revenueGrowth", fund.value.source, asOf, fund.value.note);
      }
      if (fund.value.epsGrowth != null) {
        data.epsGrowth = fund.value.epsGrowth;
        provenance = mergeProv(provenance, "epsGrowth", fund.value.source, asOf, fund.value.note);
      }
      if (fund.value.marketCap != null) {
        data.marketCap = fund.value.marketCap;
        provenance = mergeProv(provenance, "marketCap", fund.value.source, asOf, fund.value.note);
      }
    }
    if (analyst.value) {
      const asOf = analyst.value.asOf;
      const pairs: Array<[string, number | null]> = [
        ["strongBuy", analyst.value.strongBuy],
        ["buy", analyst.value.buy],
        ["hold", analyst.value.hold],
        ["sell", analyst.value.sell],
        ["strongSell", analyst.value.strongSell],
        ["targetMean", analyst.value.targetMean],
        ["targetHigh", analyst.value.targetHigh],
        ["targetLow", analyst.value.targetLow],
      ];
      for (const [key, value] of pairs) {
        if (value == null) continue;
        data[key] = value;
        provenance = mergeProv(provenance, key, analyst.value.source, asOf, analyst.value.note);
      }
      if (analyst.value.consensusLabel) {
        data.consensusLabel = analyst.value.consensusLabel;
        provenance = mergeProv(provenance, "consensusLabel", analyst.value.source, asOf, analyst.value.note);
      }
    }
    if (insider.value) {
      const asOf = insider.value.asOf;
      const pairs: Array<[string, number | null]> = [
        ["insiderNetShares", insider.value.netShares],
        ["insiderNetValue", insider.value.netValue],
        ["insiderBuys", insider.value.buys],
        ["insiderSells", insider.value.sells],
      ];
      for (const [key, value] of pairs) {
        if (value == null) continue;
        data[key] = value;
        provenance = mergeProv(provenance, key, insider.value.source, asOf, insider.value.note);
      }
    }
    if (!Object.keys(data).length) continue;
    await prisma.marketSnapshot.upsert({
      where: { symbol: stock.symbol },
      update: { ...data, provenance, dataMode: "live" },
      create: { symbol: stock.symbol, ...data, provenance, dataMode: "live" },
    });
  }
}

async function refreshNews() {
  const hub = createHub(process.env, { warn: (obj, msg) => logger.warn(obj, msg) });
  const stocks = await prisma.stock.findMany({ where: { active: true } });
  for (const stock of stocks) {
    const result = await hub.getNews(stock.symbol);
    refreshes.inc({ op: "news", result: result.value?.length ? "ok" : "empty" });
    if (!result.value?.length) continue;
    await prisma.newsItem.deleteMany({ where: { symbol: stock.symbol, isDemo: false, provider: result.provider ?? "finnhub" } });
    await prisma.newsItem.createMany({
      data: result.value.slice(0, 12).map((item) => ({
        symbol: stock.symbol,
        headline: item.headline,
        summary: item.summary,
        url: item.url,
        sourceName: item.sourceName,
        provider: item.provider,
        publishedAt: new Date(item.publishedAt),
        isDemo: false,
      })),
    });
  }
}

async function classifyWithLlm() {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return;
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const base = (process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000);
  const stocks = await prisma.stock.findMany({ where: { OR: [{ llmThemesAsOf: null }, { llmThemesAsOf: { lt: cutoff } }] }, take: 8 });
  const allowed = new Set(["ai", "semiconductors", "cybersecurity", "cloud", "quantum", "biotech", "infrastructure"]);
  for (const stock of stocks) {
    try {
      const response = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Classify the company into zero or more of: ai, semiconductors, cybersecurity, cloud, quantum, biotech, infrastructure. Use only the description provided. Return JSON {\"themes\": string[]}. Do not invent financial numbers." },
            { role: "user", content: JSON.stringify({ name: stock.name, sector: stock.sector, industry: stock.industry, description: stock.description }) },
          ],
        }),
      });
      if (!response.ok) continue;
      const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as { themes?: unknown };
      const themes = Array.isArray(parsed.themes) ? parsed.themes.filter((item): item is string => typeof item === "string" && allowed.has(item)) : [];
      await prisma.stock.update({ where: { symbol: stock.symbol }, data: { llmThemes: themes, llmThemesAsOf: new Date(), llmThemesModel: model } });
    } catch (error) {
      logger.warn({ err: error instanceof Error ? error.message : "llm", symbol: stock.symbol }, "theme classification skipped");
    }
  }
}

function every(ms: number, fn: () => Promise<void>) {
  const run = () => {
    fn().catch((error) => logger.error({ err: error instanceof Error ? error.message : "job" }, "job failed"));
  };
  run();
  return setInterval(run, ms);
}

logger.info({ demo: demoMode() }, "worker starting");
if (demoMode()) {
  every(Number(process.env.DEMO_TICK_MS ?? 2000), demoTick);
} else {
  every(Number(process.env.QUOTE_REFRESH_MS ?? 60_000), refreshQuotes);
  every(Number(process.env.BARS_REFRESH_MS ?? 1_800_000), refreshBars);
  every(Number(process.env.FUNDAMENTAL_REFRESH_MS ?? 21_600_000), refreshFundamentals);
  every(Number(process.env.NEWS_REFRESH_MS ?? 900_000), refreshNews);
  every(Number(process.env.FUNDAMENTAL_REFRESH_MS ?? 21_600_000), refreshDividends);
  every(86_400_000, classifyWithLlm);
}
async function refreshDividends() {
  const hub = createHub(process.env, { warn: (obj, msg) => logger.warn(obj, msg) });
  const stocks = await prisma.stock.findMany({ where: { active: true, lists: { has: "dividend" } } });
  for (const stock of stocks) {
    const result = await hub.getDividendYears(stock.symbol);
    refreshes.inc({ op: "dividends", result: result.value?.length ? "ok" : "empty" });
    if (!result.value?.length) continue;
    await prisma.annualPoint.deleteMany({ where: { symbol: stock.symbol, isDemo: true } });
    const asOf = new Date();
    for (const point of result.value) {
      const existing = await prisma.annualPoint.findUnique({ where: { symbol_year: { symbol: stock.symbol, year: point.year } } });
      if (existing && !existing.isDemo) {
        await prisma.annualPoint.update({ where: { symbol_year: { symbol: stock.symbol, year: point.year } }, data: { dividendPerShare: point.dividendPerShare, source: "fmp", asOf } });
      } else {
        await prisma.annualPoint.upsert({
          where: { symbol_year: { symbol: stock.symbol, year: point.year } },
          update: { dividendPerShare: point.dividendPerShare, close: null, source: "fmp", isDemo: false, asOf },
          create: { symbol: stock.symbol, year: point.year, dividendPerShare: point.dividendPerShare, close: null, source: "fmp", isDemo: false, asOf },
        });
      }
    }
  }
}

every(5_000, evaluateAlerts);

const metricsPort = Number(process.env.WORKER_METRICS_PORT ?? 3849);
http.createServer(async (req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, demoMode: demoMode() }));
    return;
  }
  if (req.url === "/metrics") {
    res.writeHead(200, { "content-type": register.contentType });
    res.end(await register.metrics());
    return;
  }
  res.writeHead(404);
  res.end();
}).listen(metricsPort, "0.0.0.0");
