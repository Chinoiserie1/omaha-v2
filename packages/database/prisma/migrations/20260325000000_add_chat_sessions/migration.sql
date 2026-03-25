-- CreateTable
CREATE TABLE "ChatSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatSession_userId_createdAt_idx" ON "ChatSession"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatSession" ADD CONSTRAINT "ChatSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 1: Add sessionId as nullable first
ALTER TABLE "ChatMessage" ADD COLUMN "sessionId" TEXT;

-- Step 2: Create a default session for each user that has chat messages
INSERT INTO "ChatSession" ("id", "userId", "createdAt")
SELECT
    'sess_' || "userId",
    "userId",
    MIN("createdAt")
FROM "ChatMessage"
GROUP BY "userId";

-- Step 3: Link existing messages to their user's default session
UPDATE "ChatMessage" SET "sessionId" = 'sess_' || "userId";

-- Step 4: Make sessionId NOT NULL
ALTER TABLE "ChatMessage" ALTER COLUMN "sessionId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "ChatMessage_sessionId_createdAt_idx" ON "ChatMessage"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChatSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
