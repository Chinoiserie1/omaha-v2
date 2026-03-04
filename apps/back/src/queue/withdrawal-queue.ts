import { Queue } from "bullmq";
import { getRedisConnectionConfig } from "../infra/redis-config.js";
import { logger } from "../utils/logger.js";
import {
  computeBatchId,
  remainingBatchWindowMs,
} from "./batch-utils.js";

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
 *
 * By default the job is delayed until the current batch window closes,
 * allowing multiple redeem confirmations to be fulfilled in a single tx.
 * BullMQ deduplicates jobs with the same deterministic jobId, so only
 * one fulfill job exists per vault per batch window.
 */
export async function enqueueFulfillJob(
  vaultId: string,
  options?: { delayMs?: number },
): Promise<void> {
  const q = getWithdrawalQueue();
  const now = Date.now();
  const delay = options?.delayMs ?? remainingBatchWindowMs(now);
  const batchId = computeBatchId(vaultId, now);
  const jobId = `fulfill-${batchId}`;

  try {
    await q.add(`fulfill:${vaultId}`, { vaultId }, { jobId, delay });
    logger.info({ vaultId, jobId, delay }, "Fulfill job enqueued");
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
