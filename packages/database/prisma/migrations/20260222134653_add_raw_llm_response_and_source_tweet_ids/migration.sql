-- AlterTable
ALTER TABLE "ClassifiedTweet" ADD COLUMN     "rawLlmResponse" JSONB;

-- AlterTable
ALTER TABLE "PortfolioSnapshot" ADD COLUMN     "sourceTweetIds" TEXT[];
