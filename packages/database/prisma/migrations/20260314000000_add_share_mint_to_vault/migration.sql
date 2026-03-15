-- AlterTable
ALTER TABLE "Vault" ADD COLUMN "shareMint" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Vault_shareMint_key" ON "Vault"("shareMint");
