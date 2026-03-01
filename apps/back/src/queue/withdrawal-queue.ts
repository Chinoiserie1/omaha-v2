import { Queue } from "bullmq";
import { getRedisConnectionConfig } from "../infra/redis-config.js";
import { logger } from "../utils/logger.js";

export interface FulfillJobData {
  vaultId: string;
}

export interface FulfillJobResult {
  processedCount: number;
  failedCount: number;
}

const QUEUE_NAME = "withdrawal";

let queue: Queue<FulfillJobData, FulfillJobResult> | null = null;

export function getWithdrawalQueue(): Queue<FulfillJobData, FulfillJobResult> {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, {
      connection: getRedisConnectionConfig(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: { age: 86_400 }, // 24h
        removeOnFail: { age: 604_800 }, // 7d
      },
    });
  }
  return queue;
}

/**
 * Enqueue a fulfill job for a vault. The worker will call fulfillIx
 * to transition PROCESSING → CLAIMABLE.
 */
export async function enqueueFulfillJob(vaultId: string): Promise<void> {
  const q = getWithdrawalQueue();
  const jobId = `fulfill:${vaultId}:${Date.now()}`;

  try {
    await q.add(`fulfill:${vaultId}`, { vaultId }, { jobId });
    logger.info({ vaultId, jobId }, "Fulfill job enqueued");
  } catch (err) {
    logger.error({ vaultId, jobId, err }, "Failed to enqueue fulfill job");
    throw err;
  }
}

export async function closeWithdrawalQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
}
