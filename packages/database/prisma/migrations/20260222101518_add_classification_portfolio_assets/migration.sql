-- CreateTable
CREATE TABLE "ClassifiedTweet" (
    "id" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "assets" TEXT[],
    "sentiment" TEXT,
    "conviction" TEXT,
    "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassifiedTweet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortfolioSnapshot" (
    "id" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "thesisSummary" TEXT NOT NULL,
    "allocations" JSONB NOT NULL,
    "changes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeableAsset" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TradeableAsset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClassifiedTweet_tweetId_key" ON "ClassifiedTweet"("tweetId");

-- CreateIndex
CREATE INDEX "ClassifiedTweet_tweetId_idx" ON "ClassifiedTweet"("tweetId");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_kolId_createdAt_idx" ON "PortfolioSnapshot"("kolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TradeableAsset_symbol_key" ON "TradeableAsset"("symbol");

-- AddForeignKey
ALTER TABLE "ClassifiedTweet" ADD CONSTRAINT "ClassifiedTweet_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "Tweet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "Kol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
