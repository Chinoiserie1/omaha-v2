-- CreateTable
CREATE TABLE "PortfolioValueSnapshot" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "totalValueUsd" DOUBLE PRECISION NOT NULL,
    "holdings" JSONB NOT NULL,
    "snapshotDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioValueSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortfolioValueSnapshot_walletAddress_snapshotDate_idx" ON "PortfolioValueSnapshot"("walletAddress", "snapshotDate");
