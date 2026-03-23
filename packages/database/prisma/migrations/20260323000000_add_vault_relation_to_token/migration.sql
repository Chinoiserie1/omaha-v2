-- AlterTable: Add optional vaultId FK to Token (one-to-one relation)
ALTER TABLE "Token" ADD COLUMN "vaultId" TEXT;

-- CreateIndex: Unique constraint (one Token per Vault)
CREATE UNIQUE INDEX "Token_vaultId_key" ON "Token"("vaultId");

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_vaultId_fkey" FOREIGN KEY ("vaultId") REFERENCES "Vault"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: Link existing vaults (by shareMint) to their Token records
UPDATE "Token" t
SET "vaultId" = v.id, "isVault" = true
FROM "Vault" v
WHERE v."shareMint" IS NOT NULL
  AND t.mint = v."shareMint";
