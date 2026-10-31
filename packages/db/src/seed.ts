import "./env.ts";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateDemoDataset } from "@alphatape/shared";

const prisma = new PrismaClient();

async function main() {
  const overwrite = process.env.SEED_OVERWRITE === "true";
  const dataset = generateDemoDataset();
  const passwordHash = await bcrypt.hash("DemoPass123!", 10);

  await prisma.user.upsert({
    where: { email: "adi@demo.local" },
    update: { name: "Adi", locale: "he" },
    create: { email: "adi@demo.local", name: "Adi", locale: "he", passwordHash },
  });
  const user = await prisma.user.findUniqueOrThrow({ where: { email: "adi@demo.local" } });
  if (overwrite) {
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  }
  await prisma.watchlist.upsert({
    where: { userId_name: { userId: user.id, name: "ברירת מחדל" } },
    update: {},
    create: { userId: user.id, name: "ברירת מחדל" },
  });

  const keep = new Set(dataset.stocks.map((stock) => stock.symbol));
  await prisma.dailyBar.deleteMany({ where: { isDemo: true, symbol: { notIn: [...keep] } } });
  await prisma.newsItem.deleteMany({ where: { isDemo: true, symbol: { notIn: [...keep] } } });
  await prisma.annualPoint.deleteMany({ where: { isDemo: true, symbol: { notIn: [...keep] } } });
  await prisma.marketSnapshot.deleteMany({ where: { dataMode: "demo", symbol: { notIn: [...keep] } } });
  await prisma.dividendSnapshot.deleteMany({ where: { dataMode: "demo", symbol: { notIn: [...keep] } } });
  await prisma.stock.deleteMany({ where: { symbol: { notIn: [...keep] } } });

  for (const stock of dataset.stocks) {
    const profileLists = dataset.lists[stock.symbol] ?? [];
    await prisma.stock.upsert({
      where: { symbol: stock.symbol },
      update: {
        name: stock.name,
        nameHe: stock.nameHe,
        exchange: stock.exchange,
        currency: stock.currency,
        country: stock.country,
        sector: stock.sector,
        industry: stock.industry,
        themes: stock.profileThemes,
        description: stock.description,
        lists: profileLists,
        active: true,
      },
      create: {
        symbol: stock.symbol,
        name: stock.name,
        nameHe: stock.nameHe,
        exchange: stock.exchange,
        currency: stock.currency,
        country: stock.country,
        sector: stock.sector,
        industry: stock.industry,
        themes: stock.profileThemes,
        description: stock.description,
        lists: profileLists,
      },
    });
  }

  const existing = await prisma.marketSnapshot.findMany({ select: { symbol: true, dataMode: true } });
  const protectedSymbols = new Set(existing.filter((row) => row.dataMode !== "demo" && !overwrite).map((row) => row.symbol));
  const symbols = dataset.stocks.map((stock) => stock.symbol).filter((symbol) => !protectedSymbols.has(symbol));

  if (symbols.length) {
    await prisma.dailyBar.deleteMany({ where: { symbol: { in: symbols }, isDemo: true } });
    await prisma.newsItem.deleteMany({ where: { symbol: { in: symbols }, isDemo: true } });
  }

  for (const stock of dataset.stocks) {
    if (protectedSymbols.has(stock.symbol)) continue;
    const data = {
      price: stock.price,
      change: stock.change,
      changePercent: stock.changePercent,
      open: stock.open,
      high: stock.high,
      low: stock.low,
      prevClose: stock.prevClose,
      volume: stock.volume,
      avgVolume: stock.avgVolume,
      marketCap: stock.marketCap,
      high52w: stock.high52w,
      low52w: stock.low52w,
      pe: stock.pe,
      revenueGrowth: stock.revenueGrowth,
      epsGrowth: stock.epsGrowth,
      shortInterest: stock.shortInterest,
      institutionalOwnership: stock.institutionalOwnership,
      insiderNetShares: stock.insiderNetShares,
      insiderNetValue: stock.insiderNetValue,
      insiderBuys: stock.insiderBuys,
      insiderSells: stock.insiderSells,
      consensusLabel: stock.consensusLabel ?? null,
      strongBuy: stock.strongBuy,
      buy: stock.buy,
      hold: stock.hold,
      sell: stock.sell,
      strongSell: stock.strongSell,
      targetMean: stock.targetMean,
      targetHigh: stock.targetHigh,
      targetLow: stock.targetLow,
      revisionTrend: stock.revisionTrend,
      rsi14: stock.rsi14,
      macd: stock.macd,
      macdSignal: stock.macdSignal,
      macdHist: stock.macdHist,
      sma50: stock.sma50,
      sma200: stock.sma200,
      volatility: stock.volatility,
      atrContraction: stock.atrContraction,
      provenance: stock.provenance,
      dataMode: stock.dataMode,
    };
    await prisma.marketSnapshot.upsert({
      where: { symbol: stock.symbol },
      update: data,
      create: { symbol: stock.symbol, ...data },
    });
  }

  const barRows = dataset.bars.filter((bar) => symbols.includes(bar.symbol));
  for (let i = 0; i < barRows.length; i += 2000) {
    await prisma.dailyBar.createMany({
      data: barRows.slice(i, i + 2000).map((bar) => ({
        symbol: bar.symbol,
        date: new Date(`${bar.date}T00:00:00.000Z`),
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        source: bar.source,
        isDemo: true,
      })),
      skipDuplicates: true,
    });
  }

  const newsRows = dataset.news.filter((item) => symbols.includes(item.symbol));
  if (newsRows.length) {
    await prisma.newsItem.createMany({
      data: newsRows.map((item) => ({
        symbol: item.symbol,
        headline: item.headline,
        summary: item.summary,
        url: item.url,
        sourceName: item.sourceName,
        provider: item.provider,
        publishedAt: new Date(item.publishedAt),
        isDemo: true,
      })),
    });
  }

  const annualSymbols = [...new Set(dataset.annual.map((point) => point.symbol))].filter((symbol) => !protectedSymbols.has(symbol));
  if (annualSymbols.length) {
    await prisma.annualPoint.deleteMany({ where: { symbol: { in: annualSymbols }, isDemo: true } });
  }
  const annualRows = dataset.annual.filter((point) => annualSymbols.includes(point.symbol));
  if (annualRows.length) {
    await prisma.annualPoint.createMany({
      data: annualRows.map((point) => ({
        symbol: point.symbol,
        year: point.year,
        dividendPerShare: point.dividendPerShare,
        close: point.close,
        source: point.source,
        isDemo: true,
        asOf: new Date(point.asOf),
      })),
    });
  }
  for (const input of dataset.dividendInputs) {
    if (protectedSymbols.has(input.symbol)) continue;
    await prisma.dividendSnapshot.upsert({
      where: { symbol: input.symbol },
      update: {
        eps: input.eps,
        beta: input.beta,
        debtToEquity: input.debtToEquity,
        interestCoverage: input.interestCoverage,
        provenance: input.provenance,
        dataMode: input.dataMode,
      },
      create: {
        symbol: input.symbol,
        eps: input.eps,
        beta: input.beta,
        debtToEquity: input.debtToEquity,
        interestCoverage: input.interestCoverage,
        provenance: input.provenance,
        dataMode: input.dataMode,
      },
    });
  }

  console.log(`Seeded ${symbols.length} demo snapshots, ${barRows.length} bars, ${newsRows.length} demo news items, ${annualRows.length} annual dividend points. Protected live symbols: ${protectedSymbols.size}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
