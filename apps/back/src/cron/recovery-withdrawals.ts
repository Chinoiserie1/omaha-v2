import { prisma } from "@repo/database";
import { logger } from "../utils/logger.js";
import { isRedisAvailable } from "../infra/redis.js";
import * as withdrawalRepo from "../store/withdrawal.repository.js";
import * as vaultRepo from "../store/vault.repository.js";
import { enqueueFulfillJob } from "../queue/withdrawal-queue.js";
import { checkClaimConsumedOnChain } from "../services/withdrawal-claim.service.js";

const REQUESTED_TIMEOUT_MS = 30 * 60_000; // 30 min — user never signed
const PROCESSING_TIMEOUT_MS = 15 * 60_000; // 15 min — fulfill didn't happen
const CLAIMABLE_TIMEOUT_MS = 2 * 60 * 60_000; // 2 hours — claim may have landed on-chain

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
        if (!enqueuedVaults.has(req.vaultId)) {
          await enqueueFulfillJob(req.vaultId, { delayMs: 0 });
          enqueuedVaults.add(req.vaultId);
        }
      }
    }
  }

  // Auto-recover stuck CLAIMABLE records (claim may have landed on-chain)
  const stuckClaimable = await withdrawalRepo.findStuckClaimable(
    CLAIMABLE_TIMEOUT_MS,
  );
  if (stuckClaimable.length > 0) {
    logger.warn(
      { count: stuckClaimable.length },
      "Found stuck CLAIMABLE withdrawals, checking on-chain state",
    );

    for (const req of stuckClaimable) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: req.userId },
        });
        const vault = await vaultRepo.findVaultById(req.vaultId);

        if (!user?.walletAddress || !vault?.statePda) {
          logger.warn(
            { withdrawalId: req.id },
            "Cannot check on-chain state: missing wallet or vault PDA",
          );
          continue;
        }

        const consumed = await checkClaimConsumedOnChain(
          vault.statePda,
          user.walletAddress,
        );

        if (consumed) {
          await withdrawalRepo.updateStatus(req.id, "CLAIMED", {
            claimedAt: new Date(),
          });
          logger.info(
            { withdrawalId: req.id },
            "Auto-recovered stuck CLAIMABLE → CLAIMED (on-chain claim consumed)",
          );
        }
      } catch (err) {
        logger.error(
          { withdrawalId: req.id, err },
          "Error checking on-chain state for stuck CLAIMABLE",
        );
      }
    }
  }
}
