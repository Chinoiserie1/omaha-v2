-- CreateTable
CREATE TABLE "KolVault" (
    "id" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "statePda" TEXT NOT NULL,
    "vaultName" TEXT NOT NULL,
    "vaultSymbol" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "jupiterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastRebalancedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KolVault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RebalanceEvent" (
    "id" TEXT NOT NULL,
    "kolVaultId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sellCount" INTEGER NOT NULL DEFAULT 0,
    "buyCount" INTEGER NOT NULL DEFAULT 0,
    "totalSwaps" INTEGER NOT NULL DEFAULT 0,
    "swapDetails" JSONB,
    "vaultEquityUsd" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RebalanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KolVault_kolId_key" ON "KolVault"("kolId");

-- CreateIndex
CREATE UNIQUE INDEX "KolVault_statePda_key" ON "KolVault"("statePda");

-- CreateIndex
CREATE INDEX "KolVault_kolId_idx" ON "KolVault"("kolId");

-- CreateIndex
CREATE INDEX "RebalanceEvent_kolVaultId_startedAt_idx" ON "RebalanceEvent"("kolVaultId", "startedAt");

-- CreateIndex
CREATE INDEX "RebalanceEvent_snapshotId_idx" ON "RebalanceEvent"("snapshotId");

-- AddForeignKey
ALTER TABLE "KolVault" ADD CONSTRAINT "KolVault_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "Kol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebalanceEvent" ADD CONSTRAINT "RebalanceEvent_kolVaultId_fkey" FOREIGN KEY ("kolVaultId") REFERENCES "KolVault"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
