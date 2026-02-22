-- RenameColumn (preserves existing data)
ALTER TABLE "Tweet" RENAME COLUMN "createdAt" TO "postedAt";

-- AddColumn: DB record timestamp
ALTER TABLE "Tweet" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AddColumn: thread flag
ALTER TABLE "Tweet" ADD COLUMN "isThread" BOOLEAN NOT NULL DEFAULT false;

-- DropIndex: old composite index
DROP INDEX "Tweet_kolId_createdAt_idx";

-- CreateIndex: new composite index on postedAt
CREATE INDEX "Tweet_kolId_postedAt_idx" ON "Tweet"("kolId", "postedAt");

-- CreateIndex: conversationId for thread queries
CREATE INDEX "Tweet_conversationId_idx" ON "Tweet"("conversationId");
