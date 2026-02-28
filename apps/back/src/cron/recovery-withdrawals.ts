import { env } from "../utils/env.js";
import { logger } from "../utils/logger.js";
import { isRedisAvailable } from "../infra/redis.js";
import * as withdrawalRepo from "../store/withdrawal.repository.js";
import { enqueueWithdrawalBatch } from "../queue/withdrawal-queue.js";
import { computeBatchId, remainingBatchWindowMs } from "../queue/batch-utils.js";

const PROCESSING_TIMEOUT_MS = 15 * 60_000; // 15 min

/**
 * Recovery cron: catches stuck/orphaned withdrawals.
 * - REQUESTED older than 2x batch window → re-queue
 * - PROCESSING older than 15 min → mark FAILED
 */
export async function recoverWithdrawals(): Promise<void> {
  const stuckRequestedMs = env.WITHDRAWAL_BATCH_WINDOW_MS * 2;

  // Recover stuck REQUESTED records
  const stuckRequested = await withdrawalRepo.findStuckRequested(stuckRequestedMs);
  if (stuckRequested.length > 0) {
    logger.warn(
      { count: stuckRequested.length },
      "Found stuck REQUESTED withdrawals, re-queuing",
    );

    if (isRedisAvailable()) {
      for (const req of stuckRequested) {
        const now = Date.now();
        const batchId = computeBatchId(req.kolVaultId, now);
        const delayMs = remainingBatchWindowMs(now);
        await enqueueWithdrawalBatch(batchId, req.kolVaultId, delayMs);
      }
    }
  }

  // Fail stuck PROCESSING records
  const stuckProcessing = await withdrawalRepo.findStuckProcessing(PROCESSING_TIMEOUT_MS);
  if (stuckProcessing.length > 0) {
    logger.warn(
      { count: stuckProcessing.length },
      "Found stuck PROCESSING withdrawals, marking FAILED",
    );

    for (const req of stuckProcessing) {
      await withdrawalRepo.updateStatus(req.id, "FAILED", {
        errorMessage: "Processing timed out",
        errorCount: req.errorCount + 1,
        failedAt: new Date(),
      });
    }
  }
}
