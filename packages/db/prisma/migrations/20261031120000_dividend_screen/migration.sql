-- AlterTable
ALTER TABLE "Stock" ADD COLUMN "lists" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "AnnualPoint" (
    "symbol" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "dividendPerShare" DOUBLE PRECISION,
    "close" DOUBLE PRECISION,
    "source" TEXT NOT NULL,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "asOf" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnnualPoint_pkey" PRIMARY KEY ("symbol","year")
);

-- CreateTable
CREATE TABLE "DividendSnapshot" (
    "symbol" TEXT NOT NULL,
    "eps" DOUBLE PRECISION,
    "beta" DOUBLE PRECISION,
    "debtToEquity" DOUBLE PRECISION,
    "interestCoverage" DOUBLE PRECISION,
    "provenance" JSONB NOT NULL,
    "dataMode" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DividendSnapshot_pkey" PRIMARY KEY ("symbol")
);
