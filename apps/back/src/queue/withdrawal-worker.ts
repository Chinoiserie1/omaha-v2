import { Worker } from "bullmq";
import type { Job } from "bullmq";
import { getRedisConnectionConfig } from "../infra/redis-config.js";
import { processFulfillBatch } from "../services/withdrawal.service.js";
import { logger } from "../utils/logger.js";
import type { FulfillJobData, FulfillJobResult } from "./withdrawal-queue.js";

let worker: Worker<FulfillJobData, FulfillJobResult> | null = null;

export function startWithdrawalWorker(): void {
  if (worker) return;

  worker = new Worker<FulfillJobData, FulfillJobResult>(
    "withdrawal",
    async (job: Job<FulfillJobData>) => {
      const { vaultId } = job.data;
      logger.info({ vaultId, jobId: job.id }, "Processing fulfill job");

      const result = await processFulfillBatch(vaultId);

      logger.info(
        { vaultId, ...result },
        "Fulfill job processed",
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
      { jobId: job?.id, vaultId: job?.data.vaultId, err },
      "Fulfill job failed",
    );
  });

  worker.on("completed", (job) => {
    logger.info(
      { jobId: job.id, vaultId: job.data.vaultId },
      "Fulfill job completed",
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
