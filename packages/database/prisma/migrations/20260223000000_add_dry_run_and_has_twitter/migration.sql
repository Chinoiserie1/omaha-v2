-- AlterTable
ALTER TABLE "Kol" ADD COLUMN     "hasTwitter" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "KolVault" ADD COLUMN     "dryRun" BOOLEAN NOT NULL DEFAULT true;
