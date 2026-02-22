/*
  Warnings:

  - A unique constraint covering the columns `[glamVaultPda]` on the table `KolVault` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "KolVault" ADD COLUMN     "description" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "glamVaultPda" TEXT,
ADD COLUMN     "kolUsername" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "name" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "privyId" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "name" TEXT,
    "twitterId" TEXT,
    "twitterUsername" TEXT,
    "profileImageUrl" TEXT,
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_privyId_key" ON "User"("privyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_twitterId_key" ON "User"("twitterId");

-- CreateIndex
CREATE UNIQUE INDEX "KolVault_glamVaultPda_key" ON "KolVault"("glamVaultPda");
