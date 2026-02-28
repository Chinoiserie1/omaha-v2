import { Worker } from "bullmq";
import type { Job } from "bullmq";
import { getRedisConnectionConfig } from "../infra/redis-config.js";
import { processWithdrawalBatch } from "../services/withdrawal.service.js";
import { logger } from "../utils/logger.js";
import type { WithdrawalJobData, WithdrawalJobResult } from "./withdrawal-queue.js";

let worker: Worker<WithdrawalJobData, WithdrawalJobResult> | null = null;

export function startWithdrawalWorker(): void {
  if (worker) return;

  worker = new Worker<WithdrawalJobData, WithdrawalJobResult>(
    "withdrawal",
    async (job: Job<WithdrawalJobData>) => {
      const { batchId, vaultId } = job.data;
      logger.info({ batchId, vaultId, jobId: job.id }, "Processing withdrawal batch");

      const result = await processWithdrawalBatch(batchId, vaultId);

      logger.info(
        { batchId, ...result },
        "Withdrawal batch processed",
      );
      return result;
    },
    {
      connection: getRedisConnectionConfig(),
      concurrency: 1,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error(
      { jobId: job?.id, batchId: job?.data.batchId, err },
      "Withdrawal job failed",
    );
  });

  worker.on("completed", (job) => {
    logger.info(
      { jobId: job.id, batchId: job.data.batchId },
      "Withdrawal job completed",
    );
  });

  logger.info("Withdrawal worker started");
}

export async function stopWithdrawalWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    logger.info("Withdrawal worker stopped");
  }
}
