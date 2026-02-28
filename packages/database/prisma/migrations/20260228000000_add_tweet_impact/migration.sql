-- CreateTable
CREATE TABLE "TweetImpact" (
    "id" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "assets" TEXT[],
    "impactType" TEXT NOT NULL,
    "allocationDelta" DOUBLE PRECISION NOT NULL,
    "conviction" TEXT NOT NULL,
    "sentiment" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "engagementScore" DOUBLE PRECISION NOT NULL,
    "significanceScore" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TweetImpact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TweetImpact_kolId_significanceScore_idx" ON "TweetImpact"("kolId", "significanceScore");

-- CreateIndex
CREATE INDEX "TweetImpact_kolId_createdAt_idx" ON "TweetImpact"("kolId", "createdAt");

-- CreateIndex
CREATE INDEX "TweetImpact_snapshotId_idx" ON "TweetImpact"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "TweetImpact_tweetId_snapshotId_key" ON "TweetImpact"("tweetId", "snapshotId");

-- AddForeignKey
ALTER TABLE "TweetImpact" ADD CONSTRAINT "TweetImpact_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "Tweet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TweetImpact" ADD CONSTRAINT "TweetImpact_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "Kol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TweetImpact" ADD CONSTRAINT "TweetImpact_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PortfolioSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
