-- CreateTable
CREATE TABLE "kols" (
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

    CONSTRAINT "kols_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tweets" (
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

    CONSTRAINT "tweets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classified_tweets" (
    "id" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "assets" TEXT[],
    "sentiment" TEXT,
    "conviction" TEXT,
    "rawLlmResponse" JSONB,
    "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "classified_tweets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_snapshots" (
    "id" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "thesisSummary" TEXT NOT NULL,
    "allocations" JSONB NOT NULL,
    "changes" TEXT[],
    "sourceTweetIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kol_vaults" (
    "id" TEXT NOT NULL,
    "kolId" TEXT NOT NULL,
    "kolUsername" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "glam_vault_pda" TEXT,
    "statePda" TEXT NOT NULL,
    "vaultName" TEXT NOT NULL,
    "vaultSymbol" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "jupiterEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastRebalancedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kol_vaults_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rebalance_events" (
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

    CONSTRAINT "rebalance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tradeable_assets" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mint" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tradeable_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "kols_username_key" ON "kols"("username");

-- CreateIndex
CREATE UNIQUE INDEX "kols_restId_key" ON "kols"("restId");

-- CreateIndex
CREATE UNIQUE INDEX "tweets_tweetId_key" ON "tweets"("tweetId");

-- CreateIndex
CREATE INDEX "tweets_kolId_postedAt_idx" ON "tweets"("kolId", "postedAt");

-- CreateIndex
CREATE INDEX "tweets_kolId_tweetId_idx" ON "tweets"("kolId", "tweetId");

-- CreateIndex
CREATE INDEX "tweets_conversationId_idx" ON "tweets"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "classified_tweets_tweetId_key" ON "classified_tweets"("tweetId");

-- CreateIndex
CREATE INDEX "classified_tweets_tweetId_idx" ON "classified_tweets"("tweetId");

-- CreateIndex
CREATE INDEX "portfolio_snapshots_kolId_createdAt_idx" ON "portfolio_snapshots"("kolId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "kol_vaults_kolId_key" ON "kol_vaults"("kolId");

-- CreateIndex
CREATE UNIQUE INDEX "kol_vaults_glam_vault_pda_key" ON "kol_vaults"("glam_vault_pda");

-- CreateIndex
CREATE UNIQUE INDEX "kol_vaults_statePda_key" ON "kol_vaults"("statePda");

-- CreateIndex
CREATE INDEX "kol_vaults_kolId_idx" ON "kol_vaults"("kolId");

-- CreateIndex
CREATE INDEX "rebalance_events_kolVaultId_startedAt_idx" ON "rebalance_events"("kolVaultId", "startedAt");

-- CreateIndex
CREATE INDEX "rebalance_events_snapshotId_idx" ON "rebalance_events"("snapshotId");

-- CreateIndex
CREATE UNIQUE INDEX "tradeable_assets_symbol_key" ON "tradeable_assets"("symbol");

-- AddForeignKey
ALTER TABLE "tweets" ADD CONSTRAINT "tweets_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "kols"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classified_tweets" ADD CONSTRAINT "classified_tweets_tweetId_fkey" FOREIGN KEY ("tweetId") REFERENCES "tweets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_snapshots" ADD CONSTRAINT "portfolio_snapshots_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "kols"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kol_vaults" ADD CONSTRAINT "kol_vaults_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "kols"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rebalance_events" ADD CONSTRAINT "rebalance_events_kolVaultId_fkey" FOREIGN KEY ("kolVaultId") REFERENCES "kol_vaults"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
