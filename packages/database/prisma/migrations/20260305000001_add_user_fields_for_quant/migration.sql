-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('REAL', 'PLACEHOLDER');

-- AlterTable: Add new fields to User
ALTER TABLE "User" ADD COLUMN "twitterFollowerCount" INTEGER;
ALTER TABLE "User" ADD COLUMN "bio" TEXT;
ALTER TABLE "User" ADD COLUMN "hasTwitter" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "userType" "UserType" NOT NULL DEFAULT 'REAL';

-- Make privyId optional
ALTER TABLE "User" ALTER COLUMN "privyId" DROP NOT NULL;
