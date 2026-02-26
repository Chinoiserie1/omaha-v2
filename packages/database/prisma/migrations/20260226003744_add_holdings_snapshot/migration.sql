-- CreateTable
CREATE TABLE "HoldingsSnapshot" (
    "id" TEXT NOT NULL,
    "kolVaultId" TEXT NOT NULL,
    "holdings" JSONB NOT NULL,
    "totalEquityUsd" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HoldingsSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HoldingsSnapshot_kolVaultId_startDate_idx" ON "HoldingsSnapshot"("kolVaultId", "startDate");

-- CreateIndex
CREATE INDEX "HoldingsSnapshot_kolVaultId_endDate_idx" ON "HoldingsSnapshot"("kolVaultId", "endDate");

-- AddForeignKey
ALTER TABLE "HoldingsSnapshot" ADD CONSTRAINT "HoldingsSnapshot_kolVaultId_fkey" FOREIGN KEY ("kolVaultId") REFERENCES "KolVault"("id") ON DELETE CASCADE ON UPDATE CASCADE;
