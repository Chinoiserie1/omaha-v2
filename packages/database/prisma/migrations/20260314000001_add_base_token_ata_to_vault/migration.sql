-- AlterTable
ALTER TABLE "Vault" ADD COLUMN "baseTokenAta" TEXT;

-- DropColumn (legacy)
ALTER TABLE "Vault" DROP COLUMN IF EXISTS "glamVaultPda";
ALTER TABLE "Vault" DROP COLUMN IF EXISTS "jupiterEnabled";
