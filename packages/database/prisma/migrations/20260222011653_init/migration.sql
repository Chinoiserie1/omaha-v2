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
    "createdAt" TIMESTAMP(3) NOT NULL,
    "favoriteCount" INTEGER NOT NULL DEFAULT 0,
    "retweetCount" INTEGER NOT NULL DEFAULT 0,
    "replyCount" INTEGER NOT NULL DEFAULT 0,
    "bookmarkCount" INTEGER NOT NULL DEFAULT 0,
    "viewsCount" INTEGER NOT NULL DEFAULT 0,
    "isRetweet" BOOLEAN NOT NULL DEFAULT false,
    "isReply" BOOLEAN NOT NULL DEFAULT false,
    "conversationId" TEXT,
    "rawJson" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tweet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Kol_username_key" ON "Kol"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Kol_restId_key" ON "Kol"("restId");

-- CreateIndex
CREATE UNIQUE INDEX "Tweet_tweetId_key" ON "Tweet"("tweetId");

-- CreateIndex
CREATE INDEX "Tweet_kolId_createdAt_idx" ON "Tweet"("kolId", "createdAt");

-- CreateIndex
CREATE INDEX "Tweet_kolId_tweetId_idx" ON "Tweet"("kolId", "tweetId");

-- AddForeignKey
ALTER TABLE "Tweet" ADD CONSTRAINT "Tweet_kolId_fkey" FOREIGN KEY ("kolId") REFERENCES "Kol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
