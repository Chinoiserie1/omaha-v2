-- AlterTable
ALTER TABLE "KolVault" ADD COLUMN "mintAddress" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "KolVault_mintAddress_key" ON "KolVault"("mintAddress");
