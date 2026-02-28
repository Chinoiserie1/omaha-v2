-- AlterTable
ALTER TABLE "Tweet" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'twitter',
ADD COLUMN     "sourceUrl" TEXT;
