import type { FastifyReply, FastifyRequest } from "fastify";
import type { ApiResponse } from "@repo/shared";
import * as withdrawalRepo from "../../../store/withdrawal.repository.js";
import { enqueueWithdrawalBatch } from "../../../queue/withdrawal-queue.js";
import { computeBatchId, remainingBatchWindowMs } from "../../../queue/batch-utils.js";
import { env } from "../../../utils/env.js";
import { logger } from "../../../utils/logger.js";

type RetryRequest = FastifyRequest<{
  Params: { withdrawalId: string };
}>;

export async function retryWithdrawal(
  request: RetryRequest,
  reply: FastifyReply,
) {
  const { withdrawalId } = request.params;

  const withdrawal = await withdrawalRepo.findById(withdrawalId);
  if (!withdrawal) {
    return reply.status(404).send({
      success: false,
      error: "Withdrawal not found",
    } satisfies ApiResponse<never>);
  }

  if (withdrawal.status !== "FAILED") {
    return reply.status(400).send({
      success: false,
      error: `Cannot retry withdrawal in status "${withdrawal.status}"`,
    } satisfies ApiResponse<never>);
  }

  if (withdrawal.errorCount >= env.WITHDRAWAL_MAX_RETRIES) {
    return reply.status(400).send({
      success: false,
      error: `Max retries (${env.WITHDRAWAL_MAX_RETRIES}) exceeded`,
    } satisfies ApiResponse<never>);
  }

  // Reset to REQUESTED with a new batch
  const now = Date.now();
  const batchId = computeBatchId(withdrawal.kolVaultId, now);
  const delayMs = remainingBatchWindowMs(now);

  const updated = await withdrawalRepo.updateStatus(
    withdrawalId,
    "REQUESTED",
    { failedAt: null },
  );

  await enqueueWithdrawalBatch(batchId, withdrawal.kolVaultId, delayMs);

  logger.info({ withdrawalId, batchId }, "Withdrawal retry queued");

  return { success: true, data: updated };
}
