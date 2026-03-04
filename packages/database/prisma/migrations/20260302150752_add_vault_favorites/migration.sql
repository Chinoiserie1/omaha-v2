-- CreateTable
CREATE TABLE "VaultFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kolVaultId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultFavorite_userId_idx" ON "VaultFavorite"("userId");

-- CreateIndex
CREATE INDEX "VaultFavorite_kolVaultId_idx" ON "VaultFavorite"("kolVaultId");

-- CreateIndex
CREATE UNIQUE INDEX "VaultFavorite_userId_kolVaultId_key" ON "VaultFavorite"("userId", "kolVaultId");

-- AddForeignKey
ALTER TABLE "VaultFavorite" ADD CONSTRAINT "VaultFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultFavorite" ADD CONSTRAINT "VaultFavorite_kolVaultId_fkey" FOREIGN KEY ("kolVaultId") REFERENCES "KolVault"("id") ON DELETE CASCADE ON UPDATE CASCADE;
