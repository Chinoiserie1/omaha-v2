import { logger } from "../utils/logger.js";
import { isRedisAvailable } from "../infra/redis.js";
import * as withdrawalRepo from "../store/withdrawal.repository.js";
import { enqueueFulfillJob } from "../queue/withdrawal-queue.js";

const REQUESTED_TIMEOUT_MS = 30 * 60_000; // 30 min — user never signed
const PROCESSING_TIMEOUT_MS = 15 * 60_000; // 15 min — fulfill didn't happen

/**
 * Recovery cron: catches stuck/orphaned withdrawals.
 * - REQUESTED older than 30 min → mark FAILED (user never signed the redeem tx)
 * - PROCESSING older than 15 min → re-enqueue fulfill job
 */
export async function recoverWithdrawals(): Promise<void> {
  // Expire stale REQUESTED records (user never signed the queuedRedeem tx)
  const stuckRequested =
    await withdrawalRepo.findStuckRequested(REQUESTED_TIMEOUT_MS);
  if (stuckRequested.length > 0) {
    logger.warn(
      { count: stuckRequested.length },
      "Found stale REQUESTED withdrawals (user never signed), marking FAILED",
    );

    for (const req of stuckRequested) {
      await withdrawalRepo.updateStatus(req.id, "FAILED", {
        errorMessage: "Redeem transaction not signed within timeout",
        errorCount: req.errorCount + 1,
        failedAt: new Date(),
      });
    }
  }

  // Re-enqueue stuck PROCESSING records (fulfill didn't happen)
  const stuckProcessing = await withdrawalRepo.findStuckProcessing(
    PROCESSING_TIMEOUT_MS,
  );
  if (stuckProcessing.length > 0) {
    logger.warn(
      { count: stuckProcessing.length },
      "Found stuck PROCESSING withdrawals, re-enqueuing fulfill",
    );

    if (isRedisAvailable()) {
      const enqueuedVaults = new Set<string>();

      for (const req of stuckProcessing) {
        if (!enqueuedVaults.has(req.kolVaultId)) {
          await enqueueFulfillJob(req.kolVaultId);
          enqueuedVaults.add(req.kolVaultId);
        }
      }
    }
  }
}
