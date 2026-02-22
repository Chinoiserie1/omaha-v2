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

-- CreateTable
CREATE TABLE "Kol" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT,
    "restId" TEXT,
    "followersCount" INTEGER,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastFetchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Kol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tweet" (
    "id" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "fullText" TEXT NOT NULL,
    "postedAt" TIMESTAMP(3) NOT NULL,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "retweetCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "bookmarkCount" INTEGER NOT NULL DEFAULT 0,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "isRetweet" BOOLEAN NOT NULL DEFAULT false,
    "isReply" BOOLEAN NOT NULL DEFAULT false,
    "isThread" BOOLEAN NOT NULL DEFAULT false,
    "conversationId" TEXT,
    "rawJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tweet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassifiedTweet" (
    "id" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "assets" TEXT[],
    "sentiment" TEXT,
    "conviction" TEXT,
    "rawLlmResponse" JSONB,
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
    "sourceTweetIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortfolioSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KolVault" (
    "id" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "kolUsername" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "glamVaultPda" TEXT,
    "statePda" TEXT NOT NULL,
    "vaultName" TEXT NOT NULL,
    "vaultSymbol" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "jupiterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastRebalancedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KolVault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RebalanceEvent" (
    "id" TEXT NOT NULL,
    "kolVaultId" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sellCount" INTEGER NOT NULL DEFAULT 0,
    "buyCount" INTEGER NOT NULL DEFAULT 0,
    "totalSwaps" INTEGER NOT NULL DEFAULT 0,
    "swapDetails" JSONB,
    "vaultEquityUsd" DOUBLE PRECISION,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "RebalanceEvent_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "User_privyId_key" ON "User"("privyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_twitterId_key" ON "User"("twitterId");

-- CreateIndex
CREATE UNIQUE INDEX "Kol_username_key" ON "Kol"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Kol_restId_key" ON "Kol"("restId");

-- CreateIndex
CREATE UNIQUE INDEX "Tweet_tweetId_key" ON "Tweet"("tweetId");

-- CreateIndex
CREATE INDEX "Tweet_kolId_postedAt_idx" ON "Tweet"("kolId", "postedAt");

-- CreateIndex
CREATE INDEX "Tweet_kolId_tweetId_idx" ON "Tweet"("kolId", "tweetId");

-- CreateIndex
CREATE INDEX "Tweet_conversationId_idx" ON "Tweet"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassifiedTweet_tweetId_key" ON "ClassifiedTweet"("tweetId");

-- CreateIndex
CREATE INDEX "ClassifiedTweet_tweetId_idx" ON "ClassifiedTweet"("tweetId");

-- CreateIndex
CREATE INDEX "PortfolioSnapshot_kolId_createdAt_idx" ON "PortfolioSnapshot"("kolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "KolVault_kolId_key" ON "KolVault"("kolId");

-- CreateIndex
CREATE UNIQUE INDEX "KolVault_glamVaultPda_key" ON "KolVault"("glamVaultPda");

-- CreateIndex
CREATE UNIQUE INDEX "KolVault_statePda_key" ON "KolVault"("statePda");

-- CreateIndex
CREATE INDEX "KolVault_kolId_idx" ON "KolVault"("kolId");

-- CreateIndex
CREATE INDEX "RebalanceEvent_kolVaultId_startedAt_idx" ON "RebalanceEvent"("kolVaultId", "startedAt");

-- CreateIndex
CREATE INDEX "RebalanceEvent_snapshotId_idx" ON "RebalanceEvent"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeableAsset_symbol_key" ON "TradeableAsset"("symbol");

-- AddForeignKey
ALTER TABLE "Tweet" ADD CONSTRAINT "Tweet_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "Kol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassifiedTweet" ADD CONSTRAINT "ClassifiedTweet_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "Tweet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortfolioSnapshot" ADD CONSTRAINT "PortfolioSnapshot_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "Kol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KolVault" ADD CONSTRAINT "KolVault_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "Kol"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebalanceEvent" ADD CONSTRAINT "RebalanceEvent_kolVaultId_fkey" FOREIGN KEY ("kolVaultId") REFERENCES "KolVault"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RebalanceEvent" ADD CONSTRAINT "RebalanceEvent_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "PortfolioSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
