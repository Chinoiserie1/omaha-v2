-- CreateTable
CREATE TABLE "TokenPriceDaily" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenPriceDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SnapshotPerformance" (
    "id" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "fromSnapshotId" TEXT NOT NULL,
    "toSnapshotId" TEXT NOT NULL,
    "periodReturn" DOUBLE PRECISION NOT NULL,
    "cumulativeValue" DOUBLE PRECISION NOT NULL,
    "periodDays" INTEGER NOT NULL,
    "details" JSONB,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SnapshotPerformance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TokenPriceDaily_symbol_date_idx" ON "TokenPriceDaily"("symbol", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TokenPriceDaily_symbol_date_key" ON "TokenPriceDaily"("symbol", "date");

-- CreateIndex
CREATE INDEX "SnapshotPerformance_kolId_computedAt_idx" ON "SnapshotPerformance"("kolId", "computedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SnapshotPerformance_fromSnapshotId_toSnapshotId_key" ON "SnapshotPerformance"("fromSnapshotId", "toSnapshotId");

-- AddForeignKey
ALTER TABLE "SnapshotPerformance" ADD CONSTRAINT "SnapshotPerformance_fromSnapshotId_fkey" FOREIGN KEY ("fromSnapshotId") REFERENCES "PortfolioSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SnapshotPerformance" ADD CONSTRAINT "SnapshotPerformance_toSnapshotId_fkey" FOREIGN KEY ("toSnapshotId") REFERENCES "PortfolioSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
