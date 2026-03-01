-- CreateIndex
CREATE INDEX "WithdrawalRequest_status_processingAt_idx" ON "WithdrawalRequest"("status", "processingAt");
