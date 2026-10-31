import { prisma } from "@alphatape/db";
import {
  DISCLAIMER,
  aiRequestSchema,
  alertPatchSchema,
  alertSchema,
  loginSchema,
  registerSchema,
  stockQuerySchema,
  watchlistSchema,
  weightsSchema,
} from "@alphatape/shared";
import bcrypt from "bcryptjs";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { ZodError } from "zod";
import { allowAiCall, generateAnalysis } from "./ai";
import { clearAuthCookie, readUser, requireUser, setAuthCookie, signToken, weightsFor } from "./auth";
import { loadDividendScreen } from "./dividends";
import { filterRows, loadRows } from "./load";
import { logger } from "./logger";
import { httpRequests, register } from "./metrics";
import { isDemoMode, providerStatus } from "./mode";
import { cachedJson, redis } from "./redis";

export async function buildApp() {
  const app = Fastify({ loggerInstance: logger, trustProxy: true });
  await app.register(helmet, { contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } });
  const allowedOrigins = new Set(
    [process.env.WEB_ORIGIN, process.env.RENDER_EXTERNAL_URL, "http://localhost:3847", "http://127.0.0.1:3847", "http://localhost:10000", "http://127.0.0.1:10000"].filter(
      (origin): origin is string => Boolean(origin),
    ),
  );
  const localDevHost = (origin: string) => {
    try {
      const host = new URL(origin).hostname;
      return host === "localhost" || host === "127.0.0.1";
    } catch {
      return false;
    }
  };
  await app.register(cors, {
    origin: (origin, callback) => {
      callback(null, !origin || allowedOrigins.has(origin) || localDevHost(origin));
    },
    credentials: true,
  });
  await app.register(cookie);
  await app.register(rateLimit, { max: Number(process.env.RATE_LIMIT_MAX ?? 180), timeWindow: "1 minute" });

  app.addHook("onResponse", async (request, reply) => {
    httpRequests.inc({ method: request.method, route: request.routeOptions.url ?? request.url, status: String(reply.statusCode) });
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.code(400).send({ error: "validation_error", issues: error.issues });
    }
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) request.log.error({ err: error }, "request failed");
    return reply.code(status).send({ error: status >= 500 ? "internal_error" : error.message });
  });

  app.get("/health", async (_request, reply) => {
    let db = "ok";
    let cache = "ok";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = "down";
    }
    try {
      if (!redis || redis.status !== "ready") cache = "down";
      else {
        const pong = await redis.ping();
        if (pong !== "PONG") cache = "down";
      }
    } catch {
      cache = "down";
    }
    // Database is required. Redis is optional: the service stays up and the live tape falls back in-process.
    const body = {
      ok: db === "ok",
      db,
      engine: process.env.ALPHATAPE_DB === "embedded" ? "embedded" : "postgres",
      redis: cache,
      demoMode: isDemoMode(),
    };
    return reply.code(db === "ok" ? 200 : 503).send(body);
  });

  app.get("/metrics", async (_request, reply) => {
    reply.header("content-type", register.contentType);
    return reply.send(await register.metrics());
  });

  app.get("/api/v1/meta", async () => ({
    name: "AlphaTape",
    demoMode: isDemoMode(),
    disclaimer: DISCLAIMER,
    providers: providerStatus(),
    modelEstimate: true,
    tase: {
      notes: "Symbols ending in .TA are Tel Aviv listings. Polygon does not cover them. Twelve Data is requested with exchange=TASE. Finnhub, FMP, Alpha Vantage, and unofficial Yahoo are best-effort .TA lookups and return null when the feed has no row.",
    },
  }));

  app.post("/api/v1/auth/register", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (existing) return reply.code(409).send({ error: "email_taken" });
    const user = await prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        name: body.name,
        passwordHash: await bcrypt.hash(body.password, 10),
        watchlists: { create: { name: "ברירת מחדל" } },
      },
    });
    const token = await signToken(user);
    setAuthCookie(reply, token);
    return { token, user: { id: user.id, email: user.email, name: user.name, locale: user.locale } };
  });

  app.post("/api/v1/auth/login", { config: { rateLimit: { max: 15, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user || !(await bcrypt.compare(body.password, user.passwordHash))) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    const token = await signToken(user);
    setAuthCookie(reply, token);
    return { token, user: { id: user.id, email: user.email, name: user.name, locale: user.locale } };
  });

  app.post("/api/v1/auth/logout", async (_request, reply) => {
    clearAuthCookie(reply);
    return { ok: true };
  });

  app.get("/api/v1/auth/me", async (request) => {
    const user = await readUser(request);
    if (!user) return { user: null };
    return { user: { id: user.id, email: user.email, name: user.name, locale: user.locale, weights: user.settings?.weights ?? null } };
  });

  app.get("/api/v1/stocks", async (request) => {
    const query = stockQuerySchema.parse(request.query);
    const weights = await weightsFor(request);
    const rows = filterRows(await loadRows(weights), query);
    return { rows, demoMode: isDemoMode(), modelEstimate: true, count: rows.length };
  });

  app.get("/api/v1/stocks/:symbol", async (request, reply) => {
    const { symbol } = request.params as { symbol: string };
    const weights = await weightsFor(request);
    const row = (await loadRows(weights)).find((item) => item.symbol.toUpperCase() === symbol.toUpperCase());
    if (!row) return reply.code(404).send({ error: "not_found" });
    return { row, demoMode: isDemoMode() };
  });

  app.get("/api/v1/stocks/:symbol/bars", async (request, reply) => {
    const { symbol } = request.params as { symbol: string };
    const upper = symbol.toUpperCase();
    const stock = await prisma.stock.findUnique({ where: { symbol: upper } });
    if (!stock) return reply.code(404).send({ error: "not_found" });
    const bars = await cachedJson(`bars:${upper}`, 120, async () => {
      const rows = await prisma.dailyBar.findMany({ where: { symbol: upper }, orderBy: { date: "asc" } });
      return rows.map((bar) => ({
        time: bar.date.toISOString().slice(0, 10),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        source: bar.source,
        isDemo: bar.isDemo,
      }));
    });
    const source = bars[0]?.source ?? null;
    return { symbol: upper, source, demo: bars.some((bar) => bar.isDemo), bars };
  });

  app.get("/api/v1/stocks/:symbol/news", async (request, reply) => {
    const { symbol } = request.params as { symbol: string };
    const upper = symbol.toUpperCase();
    const stock = await prisma.stock.findUnique({ where: { symbol: upper } });
    if (!stock) return reply.code(404).send({ error: "not_found" });
    const items = await cachedJson(`news:${upper}`, 90, async () => {
      const rows = await prisma.newsItem.findMany({ where: { symbol: upper }, orderBy: { publishedAt: "desc" }, take: 12 });
      return rows.map((item) => ({
        id: item.id,
        headline: item.headline,
        summary: item.summary,
        url: item.url,
        sourceName: item.sourceName,
        provider: item.provider,
        publishedAt: item.publishedAt.toISOString(),
        isDemo: item.isDemo,
      }));
    });
    return { symbol: upper, items };
  });

  app.post("/api/v1/stocks/:symbol/ai", async (request, reply) => {
    const { symbol } = request.params as { symbol: string };
    const body = aiRequestSchema.parse(request.body ?? {});
    const user = await readUser(request);
    const bucket = user?.id ?? request.ip;
    if (!(await allowAiCall(bucket))) return reply.code(429).send({ error: "ai_rate_limit" });
    const weights = await weightsFor(request);
    const row = (await loadRows(weights)).find((item) => item.symbol.toUpperCase() === symbol.toUpperCase());
    if (!row) return reply.code(404).send({ error: "not_found" });
    const analysis = await generateAnalysis(row, body.locale, body.force);
    return analysis;
  });

  app.get("/api/v1/dividends", async (request) => {
    const screen = await loadDividendScreen(await weightsFor(request));
    return {
      ...screen,
      demoMode: isDemoMode(),
      modelEstimate: true,
      disclaimer: {
        en: "Long-term dividend screen. Past dividends and past price CAGR are not a forecast or a guarantee. Names appear only when the computed gates pass. Missing history is N/A and fails a gate instead of being filled in. This is not investment advice.",
        he: "מסך דיבידנד לטווח ארוך. דיבידנדים ותשואת מחיר בעבר אינם תחזית ואינם ערובה. נייר נכנס רק אם הוא עובר את הספים המחושבים. היסטוריה חסרה היא N/A ונכשלת בסף, ולא מושלמת. זה אינו ייעוץ השקעות.",
      },
    };
  });

  app.get("/api/v1/heatmap", async (request) => {
    const rows = await loadRows(await weightsFor(request));
    const sectors = new Map<string, { sector: string; changeSum: number; count: number; marketCap: number }>();
    for (const row of rows) {
      const bucket = sectors.get(row.sector) ?? { sector: row.sector, changeSum: 0, count: 0, marketCap: 0 };
      if (row.changePercent.value != null) {
        bucket.changeSum += row.changePercent.value;
        bucket.count += 1;
      }
      bucket.marketCap += row.marketCap.value ?? 0;
      sectors.set(row.sector, bucket);
    }
    return {
      demoMode: isDemoMode(),
      sectors: [...sectors.values()].map((sector) => ({
        sector: sector.sector,
        avgChangePercent: sector.count ? sector.changeSum / sector.count : null,
        marketCap: sector.marketCap || null,
        count: sector.count,
      })),
      tiles: rows.map((row) => ({
        symbol: row.symbol,
        name: row.name,
        sector: row.sector,
        currency: row.currency,
        marketCap: row.marketCap,
        changePercent: row.changePercent,
      })),
    };
  });

  app.get("/api/v1/movers", async (request) => {
    const rows = await loadRows(await weightsFor(request));
    const byChange = [...rows].filter((row) => row.changePercent.value != null).sort((a, b) => (b.changePercent.value ?? 0) - (a.changePercent.value ?? 0));
    const byVolume = [...rows].filter((row) => row.volume.value != null).sort((a, b) => (b.volume.value ?? 0) - (a.volume.value ?? 0));
    const trending = [...rows]
      .map((row) => ({
        row,
        heat: (row.changePercent.value ?? 0) * Math.log10((row.volume.value ?? 0) + 10) + (row.score.score ?? 0) / 20,
      }))
      .sort((a, b) => b.heat - a.heat)
      .slice(0, 15)
      .map((item) => item.row);
    return {
      demoMode: isDemoMode(),
      formula: "trending = daily % change * log10(volume + 10) + AI score / 20. Model estimate mixed with sourced change and volume.",
      gainers: byChange.slice(0, 15),
      losers: [...byChange].reverse().slice(0, 15),
      volume: byVolume.slice(0, 15),
      trending,
    };
  });

  app.get("/api/v1/compare", async (request, reply) => {
    const raw = (request.query as { symbols?: string }).symbols ?? "";
    const symbols = raw.split(",").map((item) => item.trim().toUpperCase()).filter(Boolean);
    if (symbols.length < 2 || symbols.length > 4) return reply.code(400).send({ error: "compare_requires_2_to_4_symbols" });
    const rows = await loadRows(await weightsFor(request));
    const picked = symbols.map((symbol) => rows.find((row) => row.symbol === symbol) ?? null);
    if (picked.some((row) => !row)) return reply.code(404).send({ error: "not_found", symbols });
    const currencies = new Set(picked.map((row) => row!.currency));
    return { rows: picked, mixedCurrencies: currencies.size > 1, note: currencies.size > 1 ? "Values are not FX-converted." : null };
  });

  app.get("/api/v1/settings", async (request) => {
    const weights = await weightsFor(request);
    return { weights, modelEstimate: true };
  });

  app.put("/api/v1/settings", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const weights = weightsSchema.parse(request.body);
    await prisma.userSettings.upsert({
      where: { userId: user.id },
      update: { weights },
      create: { userId: user.id, weights },
    });
    return { weights };
  });

  app.get("/api/v1/watchlist", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const lists = await prisma.watchlist.findMany({ where: { userId: user.id }, include: { items: true }, orderBy: { createdAt: "asc" } });
    const rows = await loadRows(await weightsFor(request));
    return {
      lists: lists.map((list) => ({
        id: list.id,
        name: list.name,
        symbols: list.items.map((item) => item.symbol),
        rows: list.items.map((item) => rows.find((row) => row.symbol === item.symbol)).filter(Boolean),
      })),
    };
  });

  app.post("/api/v1/watchlist", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const body = watchlistSchema.parse(request.body);
    const symbol = body.symbol.toUpperCase();
    const stock = await prisma.stock.findUnique({ where: { symbol } });
    if (!stock) return reply.code(404).send({ error: "not_found" });
    const list = await prisma.watchlist.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    const watchlist = list ?? (await prisma.watchlist.create({ data: { userId: user.id, name: "ברירת מחדל" } }));
    await prisma.watchlistItem.upsert({
      where: { watchlistId_symbol: { watchlistId: watchlist.id, symbol } },
      update: {},
      create: { watchlistId: watchlist.id, symbol },
    });
    return { ok: true, symbol };
  });

  app.delete("/api/v1/watchlist/:symbol", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const symbol = (request.params as { symbol: string }).symbol.toUpperCase();
    await prisma.watchlistItem.deleteMany({ where: { symbol, watchlist: { userId: user.id } } });
    return { ok: true };
  });

  app.get("/api/v1/alerts", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const alerts = await prisma.alert.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } });
    return { alerts };
  });

  app.post("/api/v1/alerts", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const body = alertSchema.parse(request.body);
    const symbol = body.symbol.toUpperCase();
    const stock = await prisma.stock.findUnique({ where: { symbol } });
    if (!stock) return reply.code(404).send({ error: "not_found" });
    const alert = await prisma.alert.create({ data: { userId: user.id, symbol, kind: body.kind, threshold: body.threshold } });
    return { alert };
  });

  app.patch("/api/v1/alerts/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const id = (request.params as { id: string }).id;
    const body = alertPatchSchema.parse(request.body);
    const existing = await prisma.alert.findFirst({ where: { id, userId: user.id } });
    if (!existing) return reply.code(404).send({ error: "not_found" });
    const alert = await prisma.alert.update({ where: { id }, data: body });
    return { alert };
  });

  app.delete("/api/v1/alerts/:id", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const id = (request.params as { id: string }).id;
    await prisma.alert.deleteMany({ where: { id, userId: user.id } });
    return { ok: true };
  });

  app.get("/api/v1/notifications", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    const items = await prisma.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 30 });
    return { items };
  });

  app.post("/api/v1/notifications/read", async (request, reply) => {
    const user = await requireUser(request, reply);
    if (!user) return;
    await prisma.notification.updateMany({ where: { userId: user.id, read: false }, data: { read: true } });
    return { ok: true };
  });

  return app;
}
