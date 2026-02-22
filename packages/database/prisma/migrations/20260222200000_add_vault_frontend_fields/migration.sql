-- AlterTable
ALTER TABLE "KolVault" ADD COLUMN     "kolUsername" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "glamVaultPda" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "KolVault_glamVaultPda_key" ON "KolVault"("glamVaultPda");
