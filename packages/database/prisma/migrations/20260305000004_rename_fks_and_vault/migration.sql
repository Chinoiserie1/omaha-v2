-- ============================================================
-- Repair: Create missing Quant records for Kols with NULL restId
-- (migration 3 may have missed these due to NULL join semantics)
-- ============================================================
INSERT INTO "Quant" (
    "id",
    "userId",
    "isActive",
    "algoEnabled",
    "lastFetchedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    k."id",
    u."id",
    k."isActive",
    k."algoEnabled",
    k."lastFetchedAt",
    k."createdAt",
    k."updatedAt"
FROM "Kol" k
JOIN "User" u ON u."twitterUsername" = k."username"
WHERE k."restId" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Quant" q WHERE q."id" = k."id");

-- ============================================================
-- Part A: Rename kolId -> quantId on Tweet, PortfolioSnapshot,
--         TweetImpact, SnapshotPerformance
-- ============================================================

-- Tweet: drop old FK and indexes, rename column, add new FK and indexes
ALTER TABLE "Tweet" DROP CONSTRAINT IF EXISTS "Tweet_kolId_fkey";
DROP INDEX IF EXISTS "Tweet_kolId_postedAt_idx";
DROP INDEX IF EXISTS "Tweet_kolId_tweetId_idx";
ALTER TABLE "Tweet" RENAME COLUMN "kolId" TO "quantId";
ALTER TABLE "Tweet" ADD CONSTRAINT "Tweet_quantId_fkey" FOREIGN KEY ("quantId") REFERENCES "Quant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Tweet_quantId_postedAt_idx" ON "Tweet"("quantId", "postedAt");
CREATE INDEX "Tweet_quantId_tweetId_idx" ON "Tweet"("quantId", "tweetId");

-- PortfolioSnapshot: drop old FK and index, rename column, add new FK and index
ALTER TABLE "PortfolioSnapshot" DROP CONSTRAINT IF EXISTS "PortfolioSnapshot_kolId_fkey";
DROP INDEX IF EXISTS "PortfolioSnapshot_kolId_createdAt_idx";
ALTER TABLE "PortfolioSnapshot" RENAME COLUMN "kolId" TO "quantId";
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_quantId_fkey" FOREIGN KEY ("quantId") REFERENCES "Quant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "PortfolioSnapshot_quantId_createdAt_idx" ON "PortfolioSnapshot"("quantId", "createdAt");

-- TweetImpact: drop old FK and indexes, rename column, add new FK and indexes
ALTER TABLE "TweetImpact" DROP CONSTRAINT IF EXISTS "TweetImpact_kolId_fkey";
DROP INDEX IF EXISTS "TweetImpact_kolId_significanceScore_idx";
DROP INDEX IF EXISTS "TweetImpact_kolId_createdAt_idx";
ALTER TABLE "TweetImpact" RENAME COLUMN "kolId" TO "quantId";
ALTER TABLE "TweetImpact" ADD CONSTRAINT "TweetImpact_quantId_fkey" FOREIGN KEY ("quantId") REFERENCES "Quant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "TweetImpact_quantId_significanceScore_idx" ON "TweetImpact"("quantId", "significanceScore");
CREATE INDEX "TweetImpact_quantId_createdAt_idx" ON "TweetImpact"("quantId", "createdAt");

-- SnapshotPerformance: drop old index, rename column, add new index (no FK, just a field)
DROP INDEX IF EXISTS "SnapshotPerformance_kolId_computedAt_idx";
ALTER TABLE "SnapshotPerformance" RENAME COLUMN "kolId" TO "quantId";
CREATE INDEX "SnapshotPerformance_quantId_computedAt_idx" ON "SnapshotPerformance"("quantId", "computedAt");

-- ============================================================
-- Part B: Rename KolVault -> Vault, kolId -> quantId,
--         drop duplicate columns
-- ============================================================

-- Drop old FK from KolVault
ALTER TABLE "KolVault" DROP CONSTRAINT IF EXISTS "KolVault_kolId_fkey";
DROP INDEX IF EXISTS "KolVault_kolId_idx";

-- Rename table
ALTER TABLE "KolVault" RENAME TO "Vault";

-- Rename kolId -> quantId
ALTER TABLE "Vault" RENAME COLUMN "kolId" TO "quantId";

-- Drop duplicate columns (data now on User via Quant relation)
ALTER TABLE "Vault" DROP COLUMN IF EXISTS "kolUsername";
ALTER TABLE "Vault" DROP COLUMN IF EXISTS "avatarUrl";
ALTER TABLE "Vault" DROP COLUMN IF EXISTS "name";
ALTER TABLE "Vault" DROP COLUMN IF EXISTS "description";

-- Rename constraint
ALTER TABLE "Vault" RENAME CONSTRAINT "KolVault_pkey" TO "Vault_pkey";

-- Add new FK and index
ALTER TABLE "Vault" ADD CONSTRAINT "Vault_quantId_fkey" FOREIGN KEY ("quantId") REFERENCES "Quant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "Vault_quantId_idx" ON "Vault"("quantId");

-- Rename unique constraints
ALTER INDEX "KolVault_kolId_key" RENAME TO "Vault_quantId_key";
ALTER INDEX "KolVault_glamVaultPda_key" RENAME TO "Vault_glamVaultPda_key";
ALTER INDEX "KolVault_statePda_key" RENAME TO "Vault_statePda_key";
ALTER INDEX "KolVault_mintAddress_key" RENAME TO "Vault_mintAddress_key";

-- ============================================================
-- Part C: Rename kolVaultId -> vaultId on RebalanceEvent,
--         HoldingsSnapshot, WithdrawalRequest, VaultFavorite
-- ============================================================

-- RebalanceEvent
ALTER TABLE "RebalanceEvent" DROP CONSTRAINT IF EXISTS "RebalanceEvent_kolVaultId_fkey";
DROP INDEX IF EXISTS "RebalanceEvent_kolVaultId_startedAt_idx";
ALTER TABLE "RebalanceEvent" RENAME COLUMN "kolVaultId" TO "vaultId";
ALTER TABLE "RebalanceEvent" ADD CONSTRAINT "RebalanceEvent_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "RebalanceEvent_vaultId_startedAt_idx" ON "RebalanceEvent"("vaultId", "startedAt");

-- HoldingsSnapshot
ALTER TABLE "HoldingsSnapshot" DROP CONSTRAINT IF EXISTS "HoldingsSnapshot_kolVaultId_fkey";
DROP INDEX IF EXISTS "HoldingsSnapshot_kolVaultId_startDate_idx";
DROP INDEX IF EXISTS "HoldingsSnapshot_kolVaultId_endDate_idx";
ALTER TABLE "HoldingsSnapshot" RENAME COLUMN "kolVaultId" TO "vaultId";
ALTER TABLE "HoldingsSnapshot" ADD CONSTRAINT "HoldingsSnapshot_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "HoldingsSnapshot_vaultId_startDate_idx" ON "HoldingsSnapshot"("vaultId", "startDate");
CREATE INDEX "HoldingsSnapshot_vaultId_endDate_idx" ON "HoldingsSnapshot"("vaultId", "endDate");

-- WithdrawalRequest
ALTER TABLE "WithdrawalRequest" DROP CONSTRAINT IF EXISTS "WithdrawalRequest_kolVaultId_fkey";
DROP INDEX IF EXISTS "WithdrawalRequest_kolVaultId_status_idx";
ALTER TABLE "WithdrawalRequest" RENAME COLUMN "kolVaultId" TO "vaultId";
ALTER TABLE "WithdrawalRequest" ADD CONSTRAINT "WithdrawalRequest_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "WithdrawalRequest_vaultId_status_idx" ON "WithdrawalRequest"("vaultId", "status");

-- VaultFavorite
ALTER TABLE "VaultFavorite" DROP CONSTRAINT IF EXISTS "VaultFavorite_kolVaultId_fkey";
DROP INDEX IF EXISTS "VaultFavorite_kolVaultId_idx";
ALTER TABLE "VaultFavorite" RENAME COLUMN "kolVaultId" TO "vaultId";
ALTER TABLE "VaultFavorite" ADD CONSTRAINT "VaultFavorite_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "VaultFavorite_vaultId_idx" ON "VaultFavorite"("vaultId");

-- Rename unique constraint on VaultFavorite
ALTER INDEX "VaultFavorite_userId_kolVaultId_key" RENAME TO "VaultFavorite_userId_vaultId_key";
